import { Request, Response } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
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
