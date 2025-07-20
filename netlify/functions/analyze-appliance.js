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

    // ULTRA DEBUG: Get custom question from URL parameter instead of multipart body
    console.log('=== CUSTOM QUESTION DEBUG ===');
    console.log('Event query parameters:', JSON.stringify(event.queryStringParameters, null, 2)); // Debug log
    console.log('All result fields:', JSON.stringify(result.fields, null, 2)); // Debug log
    
    let customQuestion = '';
    
    // First try URL parameter (most reliable)
    if (event.queryStringParameters && event.queryStringParameters.custom_question) {
      customQuestion = decodeURIComponent(event.queryStringParameters.custom_question);
      console.log('✅ Found custom question in URL:', `"${customQuestion}"`); // Debug log
    } else {
      console.log('❌ No custom question in URL parameters'); // Debug log
    }
    
    const totalFiles = parseInt(result.fields?.total_files || result.fields?.totalFiles || '1');

    console.log('Final custom question for AI:', customQuestion ? `"${customQuestion}"` : 'NONE PROVIDED'); // Debug log
    console.log('Number of files received:', result.files.length); // Debug log

    // Payment verification (set to false for testing, true for production)
    const TESTING_MODE = true; // Set to false to enable payment verification
    
    if (!TESTING_MODE) {
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
    } else {
      console.log('TESTING MODE: Skipping payment verification');
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
    let prompt = `Please analyze this appliance image and provide detailed information about:

1. Appliance identification (type, brand, model if visible)
2. Age estimation based on design features 
3. Warranty status assessment
4. Common problems for this appliance type and age
5. Top 5 replacement parts with real part numbers and costs
6. Repair video suggestions

Please format your response with the following sections:

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

## ⚠️ COMMON PROBLEMS
1. **[Most common problem]** - [Brief description of symptoms]
2. **[Second problem]** - [Brief description of symptoms]  
3. **[Third problem]** - [Brief description of symptoms]
4. **[Fourth problem]** - [Brief description of symptoms]
5. **[Fifth problem]** - [Brief description of symptoms]

## 🔧 TOP 5 REPLACEMENT PARTS & PURCHASE LINKS
- **[Part 1 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 2 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 3 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 4 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

- **[Part 5 name]**: OEM# [real part number] - **Part Cost: $XX-$XX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **RepairClinic:** https://www.repairclinic.com/SearchResults?q=[part_number]

## 🎥 REPAIR VIDEO RESOURCES
- **[Specific repair task 1]** - YouTube: "[search term like 'dryer heating element replacement']"
- **[Specific repair task 2]** - YouTube: "[search term like 'washing machine water valve fix']"
- **[Specific repair task 3]** - YouTube: "[search term like 'dishwasher door seal replacement']"

## 💡 MAINTENANCE RECOMMENDATIONS
[2-3 specific, actionable maintenance tips to prevent common problems]

## 💰 WHAT'S NEXT?
Based on the age and condition, here are your options:
- **Keep & Maintain:** [If worth maintaining]
- **Repair Needed:** [If repairs might be needed]
- **Consider Replacement:** [If approaching end of life]

Please provide specific part numbers and realistic cost estimates. Include actual YouTube search terms for repair videos.`;

    if (customQuestion) {
      prompt += `

Additionally, please answer this specific question: "${customQuestion}"`;
    }

    console.log('Calling OpenAI API...');
    console.log('=== FULL PROMPT BEING SENT TO AI ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');

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
    
    console.log('=== AI RESPONSE RECEIVED ===');
    console.log('Response exists:', !!response);
    console.log('Choices exist:', !!response.choices);
    console.log('First choice exists:', !!response.choices[0]);
    console.log('Message content exists:', !!response.choices[0]?.message?.content);
    console.log('Content length:', baseAnalysis?.length || 0);
    console.log('Base analysis:', baseAnalysis);
    console.log('=== END AI RESPONSE ===');

    // Validate the AI response
    if (!baseAnalysis || baseAnalysis.trim().length === 0) {
      throw new Error('OpenAI API returned empty response');
    }

    // Check if response looks like an error or refusal
    if (baseAnalysis.toLowerCase().includes("i can't assist") || 
        baseAnalysis.toLowerCase().includes("i'm sorry") || 
        baseAnalysis.length < 200) {
      throw new Error(`OpenAI API refused or gave insufficient response: ${baseAnalysis}`);
    }

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