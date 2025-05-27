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

            // Create the prompt
            const prompt = `    
                Analyze these two images. The first is a piece of furniture, the second is a room. 
                Provide specific recommendations to modify the furniture (color, size, style changes) 
                to better fit the room's style and dimensions. Consider:
                - Color scheme matching
                - Size proportions
                - Style consistency
                - Lighting conditions
                - Existing decor elements
            `;

            // Call OpenAI API
            const response = await openai.chat.completions.create({
                model: "gpt-4.1",
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
                max_tokens: 1000
              });

              const analysis = response.choices[0].message.content;
              res.json({ analysis });
            
        } catch (error) {
            console.error('AI analysis error:', error);
            res.status(500).json({ error: 'Failed to analyze images' });
        }
    }
];


export const generateFurnitureImage = [
    upload.fields([
      { name: 'furnitureImage', maxCount: 1 },
      { name: 'roomImage', maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
      try {
        const { description } = req.body;
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
  
        // Validate inputs
        if (!files?.furnitureImage?.[0] || !files?.roomImage?.[0] || !description) {
          return res.status(400).json({ error: 'All fields are required' });
        }
  
        // Convert images to base64
        const encodeImage = (buffer: Buffer) => buffer.toString('base64');
        const base64Furniture = encodeImage(files.furnitureImage[0].buffer);
        const base64Room = encodeImage(files.roomImage[0].buffer);
  
        // Create the image generation prompt
        const prompt = `
          Combine these two images based on the following design recommendations: 
          ${description}
          
          Requirements:
          1. Seamlessly integrate the furniture into the room
          2. Match lighting and shadows with the room's existing scheme
          3. Maintain perspective and proportions
          4. Output should be photorealistic
        `;
  
        // Call OpenAI API
        const response = await openai.responses.create({
            model: "gpt-4.1",
            input: [
              {
                role: "user",
                content: [
                  { 
                    type: "input_text",  // Correct type name
                    text: prompt 
                  },
                  {
                    type: "input_image",  // Correct type name
                    image_url: `data:image/jpeg;base64,${base64Furniture}`,
                    detail: "auto"  // Must be at same level as type/image_url
                  },
                  {
                    type: "input_image",  // Correct type name
                    image_url: `data:image/jpeg;base64,${base64Room}`,
                    detail: "auto"  // Must be at same level as type/image_url
                  },
                ],
              },
            ],
            tools: [{ type: "image_generation" }],
          });
          
  
        const imageData = response.output
            .filter((output: any) => output.type === "image_generation_call")
            .map((output: any) => output.result);

        if (imageData.length === 0) {
            return res.status(500).json({ error: 'Failed to generate image' });
        }

        // Convert base64 to Buffer
        const imageBuffer = Buffer.from(imageData[0], 'base64');

        // Set appropriate headers for binary response
        res.set({
            'Content-Type': 'image/png',
            'Content-Length': imageBuffer.length,
            'Cache-Control': 'no-store' // Optional: prevent caching
        });

        // Send the image buffer directly
        res.send(imageBuffer);

      } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Failed to generate composite image' });
      }
    }
  ];