# IIIF LLM Annotator

AI-powered transcription and annotation tool for IIIF images, built on top of the original [IIIF-imageManipulation](https://github.com/jbhoward-dublin/IIIF-imageManipulation) tool by J B Howard.

## Overview

The IIIF LLM Annotator combines traditional IIIF image manipulation capabilities with cutting-edge AI transcription using Vertex AI and Google Gemini models. Crop regions from IIIF images and automatically transcribe text, analyze content, or extract structured data using custom Pydantic schemas.

## Key Features

### 🖼️ IIIF Image Manipulation (Original Features)
- Crop, resize, rotate, and transform IIIF images
- Support for all IIIF-compliant image servers
- Direct download or persistent linking
- Multiple output formats and sizes

### 🤖 AI-Powered Transcription (New Features)
- **Vertex AI Integration**: Google Gemini 2.0 Flash Lite and 2.5 Flash Preview models
- **Custom Pydantic Schemas**: Define structured data extraction formats
- **Multi-Region Processing**: Crop and transcribe multiple areas simultaneously
- **Interactive Editor**: Field-by-field editing with visual indicators
- **Batch Transcription**: Process all regions at once
- **JSON Export**: Export coordinates and transcriptions as structured data

### 🎯 Popup Region Viewer
- Click any region to open detailed viewer
- Side-by-side image and transcription editing
- Field selector with visual status indicators
- Transcribe regions directly from the popup
- Save/cancel system with unsaved changes tracking

## Installation & Setup

### 1. Clone or Download
```bash
git clone https://github.com/project-lux/iiif-llm-annotator.git
cd iiif-llm-annotator
```

### 2. Configure Vertex AI
1. Set up your Google Cloud project with Vertex AI enabled
2. Configure the AI settings in the interface:
   - **Project ID**: Your Google Cloud project ID
   - **Location**: Your preferred region (e.g., `us-central1`)
   - **Model**: Choose between available Gemini models
   - **Access Token**: Your Google Cloud access token

### 3. Deploy
Install `index.html` in a directory with the `js/` and `img/` subdirectories.

## Usage

### Loading Images

#### Method 1: Direct URL Parameter
```
/path/index.html?imageID={IIIF_image_id}
```

Example:
```
/path/index.html?imageID=https://collections.library.yale.edu/iiif/2/32497081
```

#### Method 2: Paste Interface
1. Navigate to `/path/index.html` (no parameters)
2. Paste a IIIF image URL in the input field
3. Click "Load Image"

### AI Transcription Workflow

1. **Load a IIIF Image**: Use either method above
2. **Configure AI Settings**: Expand the Vertex AI configuration panel and enter your credentials
3. **Crop Regions**: Use the cropping tool to select areas of interest
4. **Add Regions**: Click "📍 Add Current Crop as Region"
5. **Transcribe**: 
   - Click a region to open the popup viewer
   - Click "🤖 Transcribe Region" in the popup
   - OR use "🚀 Transcribe All Regions" for batch processing
6. **Edit Results**: Use the field editor to refine transcriptions
7. **Export**: Download complete JSON with coordinates and transcriptions

### Custom Schemas

Define your own data extraction format using Pydantic syntax:

```python
class HistoricalDocument(BaseModel):
    text: str
    date_mentioned: Optional[str] = None
    location: Optional[str] = None
    persons: List[str] = []
    confidence: Optional[float] = None
```

## Example IIIF URLs

- Yale Collections: `https://collections.library.yale.edu/iiif/2/32497081`
- UCD Digital Library: `https://iiif.ucd.ie/loris/ivrla:10408`
- British Art: `https://images.britishart.yale.edu/iiif/3b437776-3278-42dc-9daf-e881d8934c66`
- National Gallery: `https://media.nga.gov/iiif/public/objects/5/7/6/576-primary-0-nativeres.ptif`

## Technical Architecture

- **Frontend**: HTML5, CSS3, JavaScript (jQuery)
- **Image Processing**: JCrop for region selection
- **AI Integration**: Vertex AI with OpenAI-compatible endpoints
- **Data Format**: JSON export with IIIF coordinates
- **Standards**: IIIF Image API 2.0/3.0 compliant

## Credits and Attribution

This project is built upon the excellent [IIIF-imageManipulation](https://github.com/jbhoward-dublin/IIIF-imageManipulation) tool created by **J B Howard** (john.b.howard@ucd.ie) at University College Dublin. The original tool provided the foundation for IIIF image manipulation, cropping, and the core user interface.

### Original Contributors
- **J B Howard** - [@john_b_howard](https://github.com/jbhoward-dublin) - Original IIIF manipulation tool
- **University College Dublin** - Original development and hosting

### AI Enhancement Contributors
- AI transcription functionality and Vertex AI integration
- Popup region viewer and field editing system
- Custom Pydantic schema support
- Multi-region batch processing

## License

This project maintains the same license as the original IIIF-imageManipulation tool. See [LICENSE](LICENSE) for details.

## Support

For issues related to:
- **Original IIIF functionality**: Refer to the [original repository](https://github.com/jbhoward-dublin/IIIF-imageManipulation)
- **AI transcription features**: Open an issue in this repository

## Mirador Integration

The original Mirador plugin (`mirador-plugin-imageManip.js`) remains compatible. To integrate:

1. Add to Mirador startup file windowSettings: `"imageManip": true`
2. Include the plugin script after `mirador.js`:
```html
<script src="/path/to/mirador-plugin-imageManip.js"></script>
```
