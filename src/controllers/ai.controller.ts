import { Request, Response } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import Product from '../models/Product';
import { uploadToS3, getS3Url } from '../utils/s3Utils';
import { v4 as uuidv4 } from 'uuid';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';


const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
})

export const analyzeRoomWithProducts = [
  upload.single('roomImage'),
  async (req: Request, res: Response) => {
    try {
      const { style } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Room image is required' });
      }

      const base64Room = file.buffer.toString('base64');
      const products = await Product.find();
      if (!products.length) {
        return res.status(404).json({ error: 'No products available' });
      }

      const structuredPrompt = `
You are an expert interior designer analyzing a room to select and place furniture products. Follow these CRITICAL rules:

1. PRODUCT SELECTION RULES:
   - Must select EXACTLY 5-7 products from the provided catalog ONLY
   - Product IDs MUST match exactly from the catalog (case-sensitive)
   - Never invent or hallucinate product IDs (e.g., no "D1", "D2", etc.)
   - If no suitable products exist, return fewer items with explanation

2. CATEGORY REQUIREMENTS:
   - Minimum 1 seating product (sofa, chair, stool)
   - Minimum 1 table surface (coffee table, side table)
   - Remaining items should complement these categories

3. VALIDATION INSTRUCTIONS:
   - Before finalizing, verify each product ID exists in the catalog
   - If unsure about a product, exclude it
   - Never guess product IDs - only use exact matches

4. OUTPUT FORMAT (strict JSON):


{
  "description": "Scene summary",
  "selectedProducts": [
    {
      "productId": "PRODUCT_ID",
      "boundingBox": {
        "x": 0,
        "y": 0,
        "width": 0,
        "height": 0
      },
      "analysis": {
        "furnitureAnalysis": {
          "type": "...",
          "color": "...",
          "style": "...",
          "size": "...",
          "materials": "...",
          "features": ["...", "..."],
          "condition": "..."
        },
        "customizationRecommendations": {
          "colorChanges": ["..."],
          "materialChanges": ["..."],
          "structuralModifications": ["..."],
          "featureAdditions": ["..."],
          "styleTransformations": ["..."],
          "modularitySuggestions": ["..."]
        },
        "summary": "..."
      }
    }
  ]
}

Product Catalog:
${products.map(p =>
  `ID: ${p._id}
Name: ${p.name}
Category: ${p.category}
Short Description: ${p.short_description}
Long Description: ${p.long_description}
Price: ${p.price}`).join('\n---\n')}

Failure to select 5-7 products will result in invalid response. Return only valid JSON.
`;

      const structuredResponse = await openai.chat.completions.create({
        model: 'gpt-4.1',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: structuredPrompt },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64Room}` },
              },
            ],
          },
        ],
        max_tokens: 2000,
      });

      const resultText = structuredResponse.choices[0].message.content;
      if (!resultText) return res.status(500).json({ error: 'No response generated' });

      let parsed;
      try {
        parsed = JSON.parse(resultText);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse AI response', raw: resultText });
      }

      res.json(parsed);
    } catch (error) {
      console.error('Room analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze room and match products' });
    }
  }
];

export const generateRoomImage = [
  upload.single('roomImage'),
  async (req: Request, res: Response) => {
    try {
      const { selectedProductIds, style } = req.body;
      const file = req.file;

      if (!file || !selectedProductIds) {
        return res.status(400).json({ error: 'Image and selectedProductIds are required' });
      }

      const base64Room = file.buffer.toString('base64');

      // Normalize selectedProductIds input
      const selectedIds = Array.isArray(selectedProductIds)
        ? selectedProductIds
        : selectedProductIds.split(',');

      // Fetch product metadata and image URLs
      const products = await Product.find({ _id: { $in: selectedIds } });
      if (!products.length) {
        return res.status(404).json({ error: 'No matching products found' });
      }

      // Download and convert each product image from S3
      const productImageInputs = await Promise.all(
        products.map(async (product) => {
          // Get signed URL first
          const s3Url = await getS3Url(product.imageKey);
          
          // Fetch the image using the signed URL
          const imageRes = await fetch(s3Url);
          if (!imageRes.ok) {
            throw new Error(`Failed to fetch image from S3: ${imageRes.statusText}`);
          }
          
          const imageBuffer = await imageRes.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');

          return {
            image: `data:image/jpeg;base64,${base64Image}`,
            description: `${product.name} (${product.category}), ${product.short_description}`,
          };
        })
      );

      // Build detailed prompt
      const furnitureDescriptions = productImageInputs.map(p => `- ${p.description}`).join('\n');

      const generationPrompt = 
`Generate a professional interior design visualization that seamlessly integrates the specified furniture into the provided room image. Follow these guidelines carefully:

1. Style & Atmosphere:
- Maintain the existing architectural style: ${style || 'match the original room style exactly'}
- Preserve the room's current lighting conditions and ambiance
- Keep the original color palette and materials unless specified otherwise

2. Product Integration:
Products to include:
${furnitureDescriptions}

Integration requirements:
- Position each item realistically within the space, considering proper scale and proportions
- Ensure all products are fully visible and properly oriented
- Maintain natural sightlines and circulation paths
- Create harmonious groupings where appropriate

3. Visual Quality:
- Photorealistic rendering quality (8K resolution detail)
- Accurate shadows and reflections
- Natural material textures
- Appropriate ambient occlusion

4. Composition Rules:
- Do not add or remove architectural elements
- Do not change the camera perspective
- Maintain the original room dimensions
- Keep the same wall/floor/ceiling treatments
- No decorative elements beyond the specified products

Output: Single high-quality JPEG image with no text, labels, or watermarks. Focus on creating a believable, magazine-quality interior design rendering that looks like a professional photograph.`.trim();

      // Build content input array
      const imageInputs = [
        {
          type: 'input_text',
          text: generationPrompt
        },
        {
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${base64Room}`,
          detail: 'auto'
        },
        ...productImageInputs.map(p => ({
          type: 'input_image',
          image_url: p.image,
          detail: 'auto'
        }))
      ];

      const imageGenResponse = await openai.responses.create({
        model: 'gpt-4.1',
        input: [
          {
            role: 'user',
            content: imageInputs as any
          }
        ],
        tools: [{
          type: 'image_generation',
          size: '1024x1024'
        }]
      });

      const imageData = imageGenResponse.output
        .filter((output: any) => output.type === "image_generation_call")
        .map((output: any) => output.result)[0];

      if (!imageData) {
        throw new Error('Image generation failed');
      }

      res.json({
        image: imageData,
        format: 'image/png'
      });

    } catch (error) {
      console.error('Image generation error:', error);
      res.status(500).json({ error: 'Failed to generate room image' });
    }
  }
];


export const analyzeFurniturePlacement = [
    upload.fields([
        { name: 'furnitureImage', maxCount: 1},
        { name: 'roomImage', maxCount: 1},
    ]),
    async (req: Request, res: Response) => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            
            // Validate files
            if (!files?.furnitureImage?.[0] || !files?.roomImage?.[0] ) {
                return res.status(400).json({ error: 'Both images are required' });
            }

            // Convert images to base64
            const furnitureImage = files.furnitureImage[0].buffer.toString('base64');
            const roomImage = files.roomImage[0].buffer.toString('base64');

            // Create the prompt with specific JSON format requirements
            const prompt = `
              You are analyzing two images: one of a piece of furniture and one of a room.
              Your task is to return a structured JSON analysis to guide the customization of the furniture so that it better fits into the room's style, dimensions, and decor.

              Return only a valid JSON object — no explanations, markdown, or surrounding text. The structure must exactly match the following schema:

              {
                "furnitureAnalysis": {
                  "type": "e.g., armchair, table",
                  "color": "...",
                  "style": "...",
                  "size": "...",
                  "materials": "...",
                  "features": ["...", "..."],
                  "condition": "..."
                },
                "roomAnalysis": {
                  "colorScheme": "...",
                  "style": "...",
                  "lighting": "...",
                  "spaceDimensions": "...",
                  "existingElements": ["...", "..."]
                },
                "customizationRecommendations": {
                  "colorChanges": ["...", "...", "...", "...", "..."],
                  "materialChanges": ["...", "...", "...", "...", "..."],
                  "structuralModifications": ["...", "...", "...", "...", "..."],
                  "featureAdditions": ["...", "...", "...", "...", "..."],
                  "styleTransformations": ["...", "...", "...", "...", "..."],
                  "modularitySuggestions": ["...", "...", "...", "...", "..."],
                  "shapeAlterations": ["...", "...", "...", "...", "..."],
                  "functionalityUpgrades": ["...", "...", "...", "...", "..."],
                  "textureOptions": ["...", "...", "...", "...", "..."]
                },
                "placementSuggestions": ["...", "..."],
                "accessoryRecommendations": ["...", "...", "...", "...", "..."],
                "summary": "...",
                "confidenceScore": 0-100
              }

              Guidelines:
              - Return strictly valid JSON with double quotes on all keys/strings
              - Do not include markdown, prose, or explanation
              - Use empty arrays [] for any category where no relevant suggestions apply
              - Keep text concise, specific, and visually descriptive
              - Base all recommendations on the contents of the two images provided

              Only the JSON object must be returned — nothing else.
              `;


            // Call OpenAI API
            const response = await openai.chat.completions.create({
                model: "gpt-4.1",
                response_format: { type: "json_object" }, // Force JSON output
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: prompt },
                      { 
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${furnitureImage}` }
                      },
                      { 
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${roomImage}` }
                      }
                    ]
                  }
                ],
                max_tokens: 1500
              });

              // Parse and validate the JSON response
              const analysis = response.choices[0].message.content;
              if (!analysis) {
                throw new Error('No analysis content returned');
              }
              
              try {
                const parsedAnalysis = JSON.parse(analysis);
                res.json(parsedAnalysis);
              } catch (parseError) {
                console.error('JSON parsing error:', parseError);
                // If JSON parsing fails, return the raw text
                res.json({ rawAnalysis: analysis });
              }
            
        } catch (error) {
            console.error('AI analysis error:', error);
            res.status(500).json({ error: 'Failed to analyze images' });
        }
    }
];


export const generateFurnitureOnlyImage = [
  upload.single('furnitureImage'),
  async (req: Request, res: Response) => {
    try {
      const { analysis } = req.body;
      if (!req.file || !analysis) {
        return res.status(400).json({ error: 'Furniture image and analysis are required' });
      }

      const parsedAnalysis = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      const base64Furniture = req.file.buffer.toString('base64');

      const {
        furnitureAnalysis,
        customizationRecommendations,
        summary
      } = parsedAnalysis;

      const prompt = `
        Create a photorealistic image of the following customized furniture:

        Type: ${furnitureAnalysis.type}
        Color: ${customizationRecommendations.colorChanges?.[0] || furnitureAnalysis.color}
        Material: ${customizationRecommendations.materialChanges?.[0] || furnitureAnalysis.materials}
        Style: ${customizationRecommendations.styleTransformations?.[0] || furnitureAnalysis.style}
        Modifications: ${customizationRecommendations.structuralModifications?.join(', ') || 'none'}
        Features: ${customizationRecommendations.featureAdditions?.join(', ') || 'none'}

        Render this furniture alone, on a neutral background with clear lighting.

        Additional context: ${summary}
      `.trim();

      const response = await openai.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64Furniture}`,
                detail: "auto"
              }
            ]
          }
        ],
        tools: [{ 
          type: "image_generation",
          size: "1024x1024"
         }]
      });

      const imageData = response.output
        .filter((output: any) => output.type === "image_generation_call")
        .map((output: any) => output.result)[0];

      if (!imageData) {
        throw new Error('Image generation failed');
      }

      res.json({
        image: imageData, // still base64
        format: 'image/png'
      });

    } catch (error) {
      console.error('Furniture-only generation error:', error);
      res.status(500).json({ error: 'Failed to generate furniture-only image' });
    }
  }
];

export const generateFurnitureInRoomImage = [
  upload.fields([
    { name: 'furnitureImage', maxCount: 1 },
    { name: 'roomImage', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const { analysis } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files?.furnitureImage?.[0] || !files?.roomImage?.[0] || !analysis) {
        return res.status(400).json({ error: 'Both images and analysis are required' });
      }

      const parsedAnalysis = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      const base64Furniture = files.furnitureImage[0].buffer.toString('base64');
      const base64Room = files.roomImage[0].buffer.toString('base64');

      const {
        furnitureAnalysis,
        customizationRecommendations,
        summary
      } = parsedAnalysis;

      const prompt = `
        Create a photorealistic image of the following customized furniture placed inside the provided room:

        Type: ${furnitureAnalysis.type}
        Color: ${customizationRecommendations.colorChanges?.[0] || furnitureAnalysis.color}
        Material: ${customizationRecommendations.materialChanges?.[0] || furnitureAnalysis.materials}
        Style: ${customizationRecommendations.styleTransformations?.[0] || furnitureAnalysis.style}
        Modifications: ${customizationRecommendations.structuralModifications?.join(', ') || 'none'}
        Features: ${customizationRecommendations.featureAdditions?.join(', ') || 'none'}

        Placement instructions:
        - Match lighting and shadows
        - Respect existing style and color scheme
        - Use realistic scale and positioning
        - ${customizationRecommendations.placementSuggestions?.[0] || 'Place logically in the room'}

        Additional context: ${summary}
      `.trim();

      const response = await openai.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64Furniture}`,
                detail: "auto"
              },
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64Room}`,
                detail: "auto"
              }
            ]
          }
        ],
        tools: [{ 
          type: "image_generation",
          size: "1024x1024"
        }]
      });

      const imageData = response.output
        .filter((output: any) => output.type === "image_generation_call")
        .map((output: any) => output.result)[0];

      if (!imageData) {
        throw new Error('Image generation failed');
      }

      res.json({
        image: imageData,
        format: 'image/png'
      });

    } catch (error) {
      console.error('Room-composite generation error:', error);
      res.status(500).json({ error: 'Failed to generate room-composite image' });
    }
  }
];
