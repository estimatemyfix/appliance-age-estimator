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

    // Check what type of request this is
    const requestType = event.queryStringParameters?.type || 'age';
    
    if (requestType === 'age') {
        return await getAgeEstimate(file, headers);
    } else if (requestType === 'parts') {
        return await getCommonParts(event, headers);
    } else if (requestType === 'manual') {
        return await getManualInfo(event, headers);
    }
}

async function getAgeEstimate(file, headers) {
    console.log('=== GETTING AGE ESTIMATE ===');
    
    const base64Image = file.content.toString('base64');
    
    // SUPER SIMPLE PROMPT - Just age and type
    const prompt = `Look at this appliance image. Tell me:

1. What type of appliance is this?
2. What year was it manufactured? (estimate based on design/style)

Format:
Appliance: [type]
Year: [4-digit year]

Keep it simple - just those two lines.`;

    console.log('Making OpenAI request for age estimate...');

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
            max_tokens: 100,
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
                error: 'Age estimation failed',
                details: `OpenAI API error: ${response.status}`
            })
        };
    }

    const data = await response.json();
    console.log('OpenAI response received, usage:', data.usage);

    const analysis = data.choices[0].message.content;
    console.log('Age analysis result:', analysis);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            type: 'age',
            analysis: analysis
        })
    };
}

async function getCommonParts(event, headers) {
    console.log('=== GETTING COMMON PARTS ===');
    
    // Parse the request body to get appliance type
    let requestData;
    try {
        requestData = JSON.parse(event.body);
        console.log('Parts request data:', requestData);
    } catch (parseError) {
        console.error('Failed to parse parts request body:', parseError);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Invalid request data',
                details: parseError.message
            })
        };
    }

    const applianceType = requestData.appliance || 'appliance';
    
    // Simple prompt for parts only
    const prompt = `List the 5 most common parts that fail on a ${applianceType}. 

Format:
1. [Part name]
2. [Part name]  
3. [Part name]
4. [Part name]
5. [Part name]

Just the part names, nothing else.`;

    console.log('Making OpenAI request for common parts...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini', // Use cheaper model for simple text
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 150,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Parts analysis failed',
                details: `OpenAI API error: ${response.status}`
            })
        };
    }

    const data = await response.json();
    const parts = data.choices[0].message.content;
    console.log('Parts result:', parts);

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            type: 'parts',
            parts: parts
        })
    };
}

async function getManualInfo(event, headers) {
    console.log('=== GETTING MANUAL INFO ===');
    
    // Parse the request body
    let requestData;
    try {
        requestData = JSON.parse(event.body);
    } catch (parseError) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'Invalid request data',
                details: parseError.message
            })
        };
    }

    const applianceType = requestData.appliance || 'appliance';
    const year = requestData.year || 'unknown';
    
    const prompt = `For a ${year} ${applianceType}, provide:

1. Model number format/pattern
2. Where to find the model number
3. Common service manual sources

Keep it brief and practical.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 200,
            temperature: 0.3
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Manual info failed',
                details: `OpenAI API error: ${response.status}`
            })
        };
    }

    const data = await response.json();
    const manualInfo = data.choices[0].message.content;

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            type: 'manual',
            manualInfo: manualInfo
        })
    };
}