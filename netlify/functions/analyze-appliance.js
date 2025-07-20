const multipart = require('lambda-multipart-parser');

exports.handler = async (event, context) => {
    console.log('=== FUNCTION START ===');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    
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
        console.log('=== PARSING MULTIPART DATA ===');
        
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

        console.log('OpenAI API key found');

        // Parse multipart form data
        let result;
        try {
            result = await multipart.parse(event);
            console.log('Multipart parsing successful');
            console.log('Result structure:', {
                hasFiles: !!result.files,
                fileCount: result.files?.length || 0,
                hasFields: !!result.fields,
                fieldKeys: Object.keys(result.fields || {})
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

        console.log('=== CALLING OPENAI API ===');

        const base64Image = file.content.toString('base64');
        console.log('Image converted to base64, length:', base64Image.length);

        // Simplified prompt for testing
        const prompt = `Look at this appliance image and tell me:
1. What type of appliance this is
2. Estimate its age (manufacturing year and current age)
3. List 5 common parts that fail on this type of appliance

Format your response like this:

## AGE
Manufacturing Year: 2015
Current Age: 9 years old

## TOP 5 COMMON PART FAILURES

1. **Heating Element**
   Part Number: WE11X10018
   Search: "dryer heating element WE11X10018"

2. **Door Seal**
   Part Number: WH08X10036
   Search: "dryer door seal WH08X10036"

[Continue for parts 3, 4, and 5]`;

        console.log('Making OpenAI request...');

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
                                    detail: 'low' // Use low detail for faster processing
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 600,
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
        console.log('Analysis preview:', analysis.substring(0, 200) + '...');

        console.log('=== SUCCESS ===');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis: analysis,
                debug: {
                    fileProcessed: true,
                    fileSize: file.content.length,
                    aiResponseLength: analysis.length
                }
            })
        };

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