const multipart = require('lambda-multipart-parser');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Starting analysis...');

        // Parse multipart form data
        const result = await multipart.parse(event);
        console.log('Parsed result:', { 
            hasFiles: !!result.files, 
            fileCount: result.files?.length || 0 
        });

        if (!result.files || result.files.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No images uploaded' })
            };
        }

        // Take the first image for analysis
        const file = result.files[0];
        console.log('Processing file:', { 
            contentType: file.contentType, 
            filename: file.filename, 
            size: file.content.length 
        });

        const base64Image = file.content.toString('base64');

        // Simple, focused AI prompt
        const prompt = `Analyze this appliance image and provide ONLY:

1. EXACT AGE: Estimate the manufacturing year and current age in years
2. TOP 5 COMMON FAILURES: List the 5 most common parts that fail on this appliance type with:
   - Part name
   - Actual part number (like WE11X10018, 5304505435, etc.)
   - Simple search term to find the part

Format your response EXACTLY like this:

## AGE
Manufacturing Year: [year]
Current Age: [X years old]

## TOP 5 COMMON PART FAILURES

1. **Heating Element**
   Part Number: WE11X10018
   Search: "dryer heating element WE11X10018"

2. **Thermal Fuse**
   Part Number: WE4X750
   Search: "thermal fuse WE4X750"

[Continue for parts 3, 4, and 5]

Be specific with real part numbers and appliance type.`;

        console.log('Calling OpenAI API...');

        // Call OpenAI API
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
                                image_url: { url: `data:${file.contentType};base64,${base64Image}` }
                            }
                        ]
                    }
                ],
                max_tokens: 800,
                temperature: 0.3
            })
        });

        console.log('OpenAI response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error:', errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const aiResponse = await response.json();
        const analysis = aiResponse.choices[0].message.content;

        console.log('Analysis completed successfully');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                analysis: analysis
            })
        };

    } catch (error) {
        console.error('Analysis error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Analysis failed',
                details: error.message 
            })
        };
    }
};