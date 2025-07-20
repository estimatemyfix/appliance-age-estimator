const multipart = require('lambda-multipart-parser');

exports.handler = async (event, context) => {
    console.log('=== FUNCTION START ===');
    console.log('Method:', event.httpMethod);
    console.log('Query params:', event.queryStringParameters);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        console.log('OPTIONS request - returning CORS headers');
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        console.log('Non-POST request');
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('=== CHECKING REQUEST TYPE ===');
        
        // Check if we have the required environment variable
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY not found in environment');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    details: 'OpenAI API key not configured'
                })
            };
        }

        // Check if this is a video links request
        const requestType = event.queryStringParameters?.type || 'analysis';
        
        if (requestType === 'videos') {
            return await generateVideoLinks(event, headers);
        } else {
            return await performMainAnalysis(event, headers);
        }

    } catch (error) {
        console.error('=== FUNCTION ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Analysis failed',
                details: error.message,
                type: error.name
            })
        };
    }
};

async function performMainAnalysis(event, headers) {
    console.log('=== PERFORMING MAIN ANALYSIS ===');
    
    // Parse multipart form data
    let result;
    try {
        result = await multipart.parse(event);
        console.log('Multipart parsing successful');
        console.log('Result structure:', {
            hasFiles: !!result.files,
            fileCount: result.files?.length || 0
        });
    } catch (parseError) {
        console.error('Multipart parsing failed:', parseError);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to parse uploaded data',
                details: parseError.message
            })
        };
    }

    if (!result.files || result.files.length === 0) {
        console.error('No files found in upload');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No images uploaded' })
        };
    }

    // Process the first file
    const file = result.files[0];
    console.log('Processing file:', {
        contentType: file.contentType,
        filename: file.filename,
        size: file.content.length
    });

    if (!file.contentType || !file.contentType.startsWith('image/')) {
        console.error('Invalid file type:', file.contentType);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Please upload a valid image file' })
        };
    }

    console.log('=== CALLING OPENAI API FOR MAIN ANALYSIS ===');

    const base64Image = file.content.toString('base64');
    console.log('Image converted to base64, length:', base64Image.length);

    // NUCLEAR PROMPT - Forces AI to ALWAYS give age estimates and parts
    const prompt = `REQUIRED TASK: You MUST analyze this appliance image and provide age estimates and parts information. Do NOT say you cannot determine age - make educated estimates based on visual design cues, style, technology visible, wear patterns, etc.

MANDATORY FORMAT - Follow this EXACT structure:

## AGE
Manufacturing Year: [ESTIMATE based on design/style/technology - REQUIRED]
Current Age: [Calculate from estimated year - REQUIRED]

## TOP 5 COMMON PART FAILURES

1. **[Part Name]**
   Part Number: [Real part number for this appliance type]

2. **[Part Name]**
   Part Number: [Real part number for this appliance type]

3. **[Part Name]**
   Part Number: [Real part number for this appliance type]

4. **[Part Name]**
   Part Number: [Real part number for this appliance type]

5. **[Part Name]**
   Part Number: [Real part number for this appliance type]

CRITICAL REQUIREMENTS:
- You MUST estimate an age even if uncertain
- Use visual design cues (style, controls, display type, etc.)
- Provide 5 real part numbers for the specific appliance type
- Follow the exact format above
- Do NOT include any other text or disclaimers`;

    console.log('Making OpenAI request for main analysis...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { 
                                url: `data:${file.contentType};base64,${base64Image}`,
                                detail: 'low'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 400,
            temperature: 0.3
        })
    });

    console.log('OpenAI response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'AI analysis failed',
                details: `OpenAI API error: ${response.status}`
            })
        };
    }

    const aiResponse = await response.json();
    console.log('OpenAI response received successfully');

    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
        console.error('Invalid AI response structure:', aiResponse);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Invalid response from AI',
                details: 'Unexpected response format'
            })
        };
    }

    const analysis = aiResponse.choices[0].message.content;
    console.log('Analysis length:', analysis.length);

    console.log('=== MAIN ANALYSIS SUCCESS ===');

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            analysis: analysis,
            type: 'main'
        })
    };
}

async function generateVideoLinks(event, headers) {
    console.log('=== GENERATING VIDEO LINKS ===');
    
    // Parse the request body to get the parts list
    let requestData;
    try {
        requestData = JSON.parse(event.body);
        console.log('Video request data:', requestData);
    } catch (parseError) {
        console.error('Failed to parse video request body:', parseError);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Invalid request data',
                details: parseError.message
            })
        };
    }

    if (!requestData.parts || !Array.isArray(requestData.parts)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Parts list required for video generation' })
        };
    }

    console.log('=== CALLING OPENAI API FOR VIDEO LINKS ===');

    const partsText = requestData.parts.join('\n');
    const prompt = `For these appliance parts, generate YouTube search terms for repair tutorials:

${partsText}

Format your response EXACTLY like this:

1. **Heating Element**
   Search: "dryer heating element replacement tutorial"

2. **Door Seal**
   Search: "dryer door seal replacement how to fix"

Continue for each part provided. Make the search terms specific for repair/replacement tutorials.`;

    console.log('Making OpenAI request for video links...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini', // Use cheaper model for this simpler task
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 300,
            temperature: 0.3
        })
    });

    console.log('OpenAI video response status:', response.status);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Video link generation failed',
                details: `OpenAI API error: ${response.status}`
            })
        };
    }

    const aiResponse = await response.json();
    console.log('OpenAI video response received successfully');

    if (!aiResponse.choices || !aiResponse.choices[0] || !aiResponse.choices[0].message) {
        console.error('Invalid AI response structure:', aiResponse);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Invalid response from AI',
                details: 'Unexpected response format'
            })
        };
    }

    const videoLinks = aiResponse.choices[0].message.content;
    console.log('Video links length:', videoLinks.length);

    console.log('=== VIDEO LINKS SUCCESS ===');

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            success: true,
            videoLinks: videoLinks,
            type: 'videos'
        })
    };
}