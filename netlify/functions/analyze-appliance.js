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

        return await performMainAnalysis(event, headers);

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

    console.log('=== CALLING OPENAI API FOR ANALYSIS ===');

    const base64Image = file.content.toString('base64');
    console.log('Image converted to base64, length:', base64Image.length);

    // SIMPLE BUT EXPANDED PROMPT - Age + 3 common parts
    const prompt = `Look at this appliance image. Please tell me:

1. What type of appliance is this?
2. Estimate the manufacturing year (2010-2024)
3. List 3 parts that commonly break on this appliance type

Keep it simple. Example format:
Appliance: Washing Machine
Manufacturing Year: 2018
Common Issues:
- Door seal
- Heating element  
- Control board`;

    console.log('Making OpenAI request for analysis...');

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
            max_tokens: 300,
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

    const data = await response.json();
    console.log('OpenAI response received, usage:', data.usage);

    const analysis = data.choices[0].message.content;
    console.log('Analysis result preview:', analysis?.substring(0, 200));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            type: 'analysis',
            analysis: analysis
        })
    };
}