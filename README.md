# 🤖 Appliance Age Estimator

A modern web application that uses AI vision technology to analyze photos of appliances and estimate their age, providing detailed information about the appliance type, features, and warranty information.

## ✨ Features

- **📸 Photo Upload**: Easy drag-and-drop or click-to-upload interface
- **🔍 AI Analysis**: Powered by OpenAI GPT-4 Vision for accurate appliance identification
- **📅 Age Estimation**: Get detailed age estimates based on design and features
- **🛡️ Warranty Information**: Receive general warranty information for your appliance type
- **🔧 Maintenance Tips**: Get helpful maintenance advice for your appliance
- **📱 Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **⚡ Fast Processing**: Quick analysis with real-time loading indicators
- **🎨 Modern UI**: Beautiful, intuitive interface with smooth animations

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- OpenAI API key

### Deployment Options

**Option 1: Deploy to Netlify (Static + Serverless Functions)**
**Option 2: Deploy to Railway/Heroku (Full Node.js App)**

### Installation

1. **Clone or download this repository**
   ```bash
   git clone <repository-url>
   cd appliance-age-estimator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   ```
   
   **Get your OpenAI API key:**
   - Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
   - Create an account or sign in
   - Generate a new API key
   - Copy and paste it into your `.env` file

4. **Start the application**
   ```bash
   npm start
   ```
   
   For development with auto-restart:
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to `http://localhost:3000`

## 🌐 Deployment to Netlify

### Setup for Netlify:

1. **Push your code to GitHub/GitLab**

2. **Connect to Netlify:**
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect your repository

3. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

4. **Add environment variables:**
   - Go to Site Settings → Environment Variables
   - Add: `OPENAI_API_KEY` = your_openai_api_key_here

5. **Deploy!** 
   - Your site will be live at `https://your-site-name.netlify.app`

### For Railway/Heroku (Full Node.js):

If you prefer a full Node.js deployment:

1. **Railway:**
   - Connect your GitHub repo at [railway.app](https://railway.app)
   - Add `OPENAI_API_KEY` environment variable
   - Deploy automatically

2. **Heroku:**
   - Install Heroku CLI
   - `heroku create your-app-name`
   - `heroku config:set OPENAI_API_KEY=your_key_here`
   - `git push heroku main`

## 📖 How to Use

1. **Upload a Photo**: 
   - Drag and drop an image file onto the upload area, or
   - Click "Choose Photo" to select a file from your device

2. **Preview Your Image**: 
   - Review the uploaded image
   - Check file details (name and size)
   - Remove and re-upload if needed

3. **Analyze Your Appliance**: 
   - Click "Analyze Appliance" to start the AI analysis
   - Wait while the AI examines your photo (usually 10-30 seconds)

4. **View Results**: 
   - Get detailed information about your appliance including:
     - Appliance type and brand (if visible)
     - Estimated age range
     - Key features that help determine age
     - General warranty information
     - Maintenance tips

5. **Start Over**: 
   - Click "Analyze Another" to upload a new photo

## 🖼️ Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- Maximum file size: 10MB

## 🔧 Technical Details

### Backend
- **Framework**: Express.js
- **File Upload**: Multer middleware
- **AI Integration**: OpenAI GPT-4 Vision API
- **Image Processing**: Base64 encoding for API submission

### Frontend
- **Technologies**: HTML5, CSS3, JavaScript (ES6+)
- **UI/UX**: Modern responsive design with animations
- **Features**: Drag & drop, file validation, loading states, error handling

### API Endpoints
- `GET /` - Main application page
- `POST /analyze-appliance` - Upload and analyze appliance photo
- `GET /health` - Health check endpoint

## 🛠️ Configuration Options

You can customize the application by modifying these settings in `server.js`:

```javascript
// File size limit (default: 10MB)
limits: {
    fileSize: 10 * 1024 * 1024
}

// OpenAI model settings
model: "gpt-4-vision-preview",
max_tokens: 1000,
temperature: 0.7
```

## 🔍 Troubleshooting

### Common Issues

**❌ "No photo uploaded" error**
- Make sure you've selected an image file before clicking "Analyze Appliance"

**❌ "File size too large" error**
- Reduce your image size to under 10MB
- Use image compression tools if needed

**❌ "Failed to analyze appliance" error**
- Check your internet connection
- Verify your OpenAI API key is correct and has sufficient credits
- Try uploading a clearer, well-lit photo

**❌ Server won't start**
- Make sure you have Node.js installed (`node --version`)
- Check that your `.env` file exists and has the correct format
- Verify your OpenAI API key is valid

**❌ Analysis takes too long**
- Large images may take longer to process
- Check your internet connection speed
- The API may be experiencing high traffic

### Getting Better Results

For the most accurate analysis:
- 📸 Use clear, well-lit photos
- 🎯 Focus on the appliance with minimal background
- 🔍 Include any visible model numbers, labels, or distinctive features
- 📐 Take photos from multiple angles if the first result isn't satisfactory

## 💡 Development

### Project Structure
```
appliance-age-estimator/
├── server.js              # Express server and API endpoints
├── package.json           # Dependencies and scripts
├── .env.example          # Environment variables template
├── public/               # Static frontend files
│   ├── index.html       # Main HTML page
│   ├── styles.css       # Styling and responsive design
│   └── script.js        # Frontend JavaScript logic
└── uploads/              # Temporary file uploads (auto-created)
```

### Available Scripts
- `npm start` - Start the production server
- `npm run dev` - Start development server with auto-reload

### Environment Variables
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3000)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Important Notes

- **API Costs**: This application uses the OpenAI API, which charges per request. Monitor your usage to avoid unexpected costs.
- **Privacy**: Uploaded images are temporarily stored on the server and deleted after analysis. However, they are sent to OpenAI for processing.
- **Accuracy**: AI estimates are based on visual analysis and may not always be 100% accurate. Use as a general guide.
- **Internet Required**: This application requires an active internet connection to function.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the [OpenAI API documentation](https://platform.openai.com/docs/guides/vision)
3. Create an issue in this repository with detailed information about your problem

---

**Built with ❤️ using Node.js, Express, and OpenAI GPT-4 Vision** 