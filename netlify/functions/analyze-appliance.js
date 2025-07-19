const OpenAI = require('openai');

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

    // Check if body exists
    if (!event.body) {
      console.error('No body in request');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No data received' })
      };
    }

    // Parse multipart form data manually
    const boundary = event.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      console.error('No boundary found in content-type');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid content type' })
      };
    }

    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
    const parts = body.split(`--${boundary}`);
    
    let imageData = null;
    let contentType = null;
    let filename = null;

    // Find the file part
    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data; name="photo"')) {
        const lines = part.split('\r\n');
        
        // Find content type
        const contentTypeLine = lines.find(line => line.startsWith('Content-Type:'));
        if (contentTypeLine) {
          contentType = contentTypeLine.split(':')[1].trim();
        }
        
        // Find filename
        const dispositionLine = lines.find(line => line.includes('filename='));
        if (dispositionLine) {
          filename = dispositionLine.split('filename="')[1]?.split('"')[0];
        }
        
        // Find the binary data (after empty line)
        const emptyLineIndex = lines.findIndex(line => line === '');
        if (emptyLineIndex !== -1 && emptyLineIndex < lines.length - 1) {
          const binaryData = lines.slice(emptyLineIndex + 1).join('\r\n');
          // Remove the trailing boundary part
          const cleanData = binaryData.split('--')[0];
          imageData = cleanData;
        }
        break;
      }
    }

    if (!imageData || !contentType) {
      console.error('No image data found in request');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image file found in upload' })
      };
    }

    // Validate file type
    if (!contentType.startsWith('image/')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Please upload a valid image file' })
      };
    }

    console.log('Image received:', { contentType, filename, dataLength: imageData.length });

    // Convert to base64 for OpenAI
    const base64Image = Buffer.from(imageData, 'binary').toString('base64');

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

    // Call OpenAI GPT-4 Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
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
        filename: filename || 'uploaded-image'
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