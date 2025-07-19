const OpenAI = require('openai');
const multipart = require('lambda-multipart-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
        body: JSON.stringify({ error: 'No photos uploaded' })
      };
    }

    // Get custom question if provided
    const customQuestion = result.fields?.custom_question || '';
    const totalFiles = parseInt(result.fields?.total_files || '1');

    // Check for payment intent ID in form data
    const paymentIntentId = result.fields?.payment_intent_id;
    if (!paymentIntentId) {
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ 
          error: 'Payment required. Please complete payment before analysis.',
          requiresPayment: true 
        })
      };
    }

    // Verify payment was successful
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        return {
          statusCode: 402,
          headers,
          body: JSON.stringify({ 
            error: 'Payment not completed. Please complete payment before analysis.',
            requiresPayment: true 
          })
        };
      }
      
      console.log('Payment verified successfully:', paymentIntentId);
    } catch (error) {
      console.error('Payment verification error:', error);
      return {
        statusCode: 402,
        headers,
        body: JSON.stringify({ 
          error: 'Payment verification failed. Please try again.',
          requiresPayment: true 
        })
      };
    }

    // Process all uploaded files
    const imageContents = [];
    let totalSize = 0;

    for (let i = 0; i < result.files.length; i++) {
      const file = result.files[i];
      
      // Validate file type
      if (!file.contentType.startsWith('image/')) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `File ${file.filename} is not a valid image` })
        };
      }

      // Validate individual file size (6MB limit for Netlify functions)
      if (file.content.length > 6 * 1024 * 1024) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `File ${file.filename} is too large. Maximum size is 6MB.` })
        };
      }

      totalSize += file.content.length;

      // Convert to base64 for OpenAI
      const base64Image = file.content.toString('base64');
      
      imageContents.push({
        type: "image_url",
        image_url: {
          url: `data:${file.contentType};base64,${base64Image}`,
          detail: "high"
        }
      });

      console.log(`Image ${i + 1} received:`, { 
        contentType: file.contentType, 
        filename: file.filename, 
        dataLength: file.content.length 
      });
    }

    // Check total payload size (Netlify has limits)
    if (totalSize > 20 * 1024 * 1024) { // 20MB total limit
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Total file size too large. Please reduce image sizes or quantity.' })
      };
    }

    console.log(`Processing ${result.files.length} images, total size: ${totalSize} bytes`);
    if (customQuestion) {
      console.log('Custom question:', customQuestion);
    }

    // Create consumer-friendly prompt for multiple appliances and custom questions
    let prompt = `You are a professional appliance expert providing detailed analysis for a homeowner. `;
    
    if (result.files.length === 1) {
      prompt += `Analyze this appliance photo and provide information in a clear, consumer-friendly format.`;
    } else {
      prompt += `Analyze these ${result.files.length} appliance photos and provide information for each appliance in a clear, consumer-friendly format.`;
    }

    if (customQuestion) {
      prompt += `\n\n**IMPORTANT: The homeowner has asked this specific question: "${customQuestion}"**
Please make sure to address this question directly in your response, in addition to the standard analysis.`;
    }

    if (result.files.length === 1) {
      prompt += `\n\nPlease structure your response EXACTLY like this format:

## 🔍 APPLIANCE IDENTIFICATION
**Type:** [Specific appliance type]
**Brand:** [Brand if visible, or "Brand not clearly visible"]
**Model:** [Model number if visible, or "Model number not visible"]

## 📅 AGE ESTIMATE
**Estimated Age:** [Age range, e.g., "8-12 years old"]
**Manufacturing Period:** [Time period, e.g., "2012-2016"]
**Confidence Level:** [High/Medium/Low]

## 🔧 KEY INDICATORS
[List 2-3 specific design features or characteristics that helped determine the age]

## ⚖️ WARRANTY STATUS
**Typical Warranty:** [Standard warranty period for this appliance type]
**Current Status:** [Likely in/out of warranty based on age]
**What's Usually Covered:** [Brief overview of typical coverage]

## 🛠️ CONDITION ASSESSMENT
**Overall Condition:** [Appears to be in Good/Fair/Poor condition]
**Potential Issues:** [Any visible concerns or common problems for this age]

## 💡 MAINTENANCE RECOMMENDATIONS
[2-3 specific, actionable maintenance tips for this appliance]

## 💰 WHAT'S NEXT?
Based on the age and condition, here are your options:
- **Keep & Maintain:** [If worth maintaining]
- **Repair Needed:** [If repairs might be needed]
- **Consider Replacement:** [If approaching end of life]`;
    } else {
      prompt += `\n\nPlease structure your response with each appliance analyzed separately:

## 📱 APPLIANCE 1 ANALYSIS
[Complete analysis using the format below]

## 📱 APPLIANCE 2 ANALYSIS 
[Complete analysis using the format below]

[Continue for each appliance...]

For each appliance, use this format:
**🔍 IDENTIFICATION**
- Type: [Specific appliance type]
- Brand: [Brand if visible]
- Model: [Model number if visible]

**📅 AGE ESTIMATE**
- Estimated Age: [Age range]
- Manufacturing Period: [Time period]
- Confidence: [High/Medium/Low]

**🔧 KEY INDICATORS & CONDITION**
[Key features that helped determine age and overall condition]

**💡 RECOMMENDATIONS**
[Maintenance tips and next steps for this specific appliance]`;
    }

    if (customQuestion) {
      prompt += `\n\n## ❓ ANSWER TO YOUR QUESTION
**Your Question:** "${customQuestion}"
**Expert Answer:** [Detailed response to the homeowner's specific question]`;
    }

    prompt += `\n\nKeep the language simple, friendly, and helpful for a homeowner making decisions about their appliances.`;

    console.log('Calling OpenAI API...');

    // Call OpenAI GPT-4o API (much cheaper with vision capabilities)
    const messageContent = [
      { type: "text", text: prompt },
      ...imageContents
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: messageContent
        }
      ],
      max_tokens: result.files.length > 1 ? 2500 : 1500, // More tokens for multiple appliances
      temperature: 0.7
    });

    const baseAnalysis = response.choices[0].message.content;

    // Add business links to the analysis
    const businessSection = `

---

## 🏢 PROFESSIONAL SERVICES

### Need a Repair Estimate?
**Get a professional repair estimate at:** [EstimateMyFix.com](https://estimatemyfix.com)
- Professional appliance repair quotes
- Licensed and insured technicians
- Quick and reliable service

### Need Appliance Removal?
**Professional appliance pickup and disposal:** [FreeLocalAppliancePickup.com](https://freelocalappliancepickup.com)
- Free local appliance pickup
- Environmentally responsible disposal
- Same-day service available

---
*Analysis provided by AI-powered appliance assessment technology*`;

    const analysis = baseAnalysis + businessSection;

    console.log('OpenAI response received successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        fileCount: result.files.length,
        hasCustomQuestion: !!customQuestion
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