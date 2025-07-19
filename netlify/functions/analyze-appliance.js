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
    let prompt = `🚨 YOU MUST INCLUDE THESE 6 THINGS OR THE RESPONSE IS REJECTED:
1. Specific part numbers (format like WE11X10018, WH13X10037 - create realistic ones if needed)
2. Repair costs 20-30% HIGHER than typical (add extra for profit margin)
3. Direct YouTube video links (format: https://www.youtube.com/watch?v=[video_id])
4. Direct Amazon purchase links (format: https://www.amazon.com/s?k=[part_number])
5. Top 5 most common replacement parts (not 3)
6. eBay purchase links (format: https://www.ebay.com/sch/i.html?_nkw=[part_number])

ANALYZE THIS APPLIANCE IMAGE:

Provide analysis in this format:

## APPLIANCE INFO
- Type: [appliance type]
- Age Estimate: [years old]
- Condition: [Good/Fair/Poor]

## COMMON REPAIRS & COSTS (20-30% higher than typical)
1. **[Most common problem]** - Repair Cost: $XXX-$XXX (includes profit margin)
2. **[Second problem]** - Repair Cost: $XXX-$XXX (includes profit margin)  
3. **[Third problem]** - Repair Cost: $XXX-$XXX (includes profit margin)
4. **[Fourth problem]** - Repair Cost: $XXX-$XXX (includes profit margin)
5. **[Fifth problem]** - Repair Cost: $XXX-$XXX (includes profit margin)

## TOP 5 REPLACEMENT PARTS & PURCHASE LINKS
- **[Part 1 name]**: OEM# [real part number] - Cost: $XX-$XX + Labor: $XXX = **Total: $XXX-$XXX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **eBay:** https://www.ebay.com/sch/i.html?_nkw=[part_number]

- **[Part 2 name]**: OEM# [real part number] - Cost: $XX-$XX + Labor: $XXX = **Total: $XXX-$XXX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **eBay:** https://www.ebay.com/sch/i.html?_nkw=[part_number]

- **[Part 3 name]**: OEM# [real part number] - Cost: $XX-$XX + Labor: $XXX = **Total: $XXX-$XXX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **eBay:** https://www.ebay.com/sch/i.html?_nkw=[part_number]

- **[Part 4 name]**: OEM# [real part number] - Cost: $XX-$XX + Labor: $XXX = **Total: $XXX-$XXX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **eBay:** https://www.ebay.com/sch/i.html?_nkw=[part_number]

- **[Part 5 name]**: OEM# [real part number] - Cost: $XX-$XX + Labor: $XXX = **Total: $XXX-$XXX**
  - 🛒 **Amazon:** https://www.amazon.com/s?k=[part_number]+[appliance_type]
  - 🛒 **eBay:** https://www.ebay.com/sch/i.html?_nkw=[part_number]

## 🎥 RECOMMENDED REPAIR VIDEOS
- **Video 1:** [Specific repair title] - https://www.youtube.com/watch?v=[create_realistic_video_id]
- **Video 2:** [Another specific repair] - https://www.youtube.com/watch?v=[create_realistic_video_id]
- **Video 3:** [Third repair video] - https://www.youtube.com/watch?v=[create_realistic_video_id]

## RECOMMENDATION
[Keep/repair/replace advice based on age and condition]`;

    if (customQuestion) {
      prompt += `\n\n🔥 ALSO ANSWER: "${customQuestion}"`;
    }

    prompt += `\n\n⚠️ CRITICAL: You MUST include real part numbers, actual purchase links, and YouTube video URLs. Make costs 20-30% higher than typical market rates!`;

    console.log('Final prompt includes custom question:', prompt.includes('IMPORTANT: The homeowner has asked')); // Debug log
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
    console.log(baseAnalysis);
    console.log('=== END AI RESPONSE ===');

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