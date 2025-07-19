const OpenAI = require('openai');
const multipart = require('lambda-multipart-parser');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  console.log('Function called:', event.httpMethod);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable in Netlify.' 
        })
      };
    }

    console.log('API key found, processing request...');

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Parse multipart form data properly
    const result = await multipart.parse(event);
    
    if (!result.files || result.files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No photo uploaded' })
      };
    }

    const file = result.files[0];
    
    // Validate file type
    if (!file.contentType.startsWith('image/')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Please upload a valid image file' })
      };
    }

    // Validate file size (6MB limit for Netlify functions)
    if (file.content.length > 6 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File size too large. Maximum size is 6MB for Netlify.' })
      };
    }

    console.log('Image received:', { 
      contentType: file.contentType, 
      filename: file.filename, 
      dataLength: file.content.length 
    });

    // Convert to base64 for OpenAI
    const base64Image = file.content.toString('base64');

    // Create detailed prompt for appliance analysis
    const prompt = `Analyze this appliance photo and provide detailed information about:

1. **Type of Appliance**: What specific appliance is this?
2. **Brand/Manufacturer**: If visible, what brand is it?
3. **Age Estimation**: Based on design, style, features, and any visible model numbers or design elements, estimate the approximate age or age range of this appliance.
4. **Key Features**: What features or design elements help determine the age?
5. **Warranty Information**: Provide general warranty information for this type of appliance (typical warranty periods, what's usually covered).
6. **Maintenance Tips**: Brief advice on maintaining this appliance.

Please be as specific as possible with the age estimation and explain your reasoning. If you can see any model numbers, serial numbers, or manufacturing dates, please mention them.

Format your response in a structured, easy-to-read way.`;

    console.log('Calling OpenAI API...');

    // Call OpenAI GPT-4o API (much cheaper with vision capabilities)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${file.contentType};base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const analysis = response.choices[0].message.content;

    console.log('OpenAI response received successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        filename: file.filename
      })
    };

  } catch (error) {
    console.error('Error analyzing appliance:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to analyze appliance', 
        details: error.message,
        type: error.name || 'Unknown error'
      })
    };
  }
}; 