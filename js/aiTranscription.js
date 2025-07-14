/*
 * aiTranscription.js: AI-powered transcription functionality for IIIF images
 * Integrates with Vertex AI and supports custom Pydantic schemas
 */

var aiTranscription = {
    regions: [],
    selectedRegionId: null,
    currentSchema: null,
    isProcessing: false,
    
    init: function() {
        this.setupEventListeners();
        this.loadDefaultSchema();
        this.showWorkspaceWhenImageLoaded();
    },
    
    setupEventListeners: function() {
        // Region management
        $('#addRegionBtn').click(() => this.addCurrentCropAsRegion());
        $('#transcribeSelectedBtn').click(() => this.transcribeSelectedRegion());
        $('#transcribeAllBtn').click(() => this.transcribeAllRegions());
        $('#clearAllBtn').click(() => this.clearAllRegions());
        $('#exportJsonBtn').click(() => this.showExportModal());
        
        // Schema management
        $('#customSchema').on('input', () => this.parseCustomSchema());
        
        // Modal events
        $(window).click((event) => {
            if (event.target === document.getElementById('exportModal')) {
                this.closeExportModal();
            }
        });
    },
    
    showWorkspaceWhenImageLoaded: function() {
        // Monitor for when an image is successfully loaded
        const checkImageInterval = setInterval(() => {
            const targetImage = $('#target');
            if (targetImage.length > 0 && targetImage.attr('src') && targetImage.attr('src') !== '') {
                $('#aiWorkspace').addClass('active');
                clearInterval(checkImageInterval);
            }
        }, 500);
    },
    
    loadDefaultSchema: function() {
        const defaultSchema = `class TranscriptionData(BaseModel):
    text: str
    confidence: Optional[float] = None
    language: Optional[str] = None
    entities: List[str] = []
    date_mentioned: Optional[str] = None
    location_mentioned: Optional[str] = None
    keywords: List[str] = []`;
        
        $('#customSchema').val(defaultSchema);
        this.parseCustomSchema();
    },
    
    parseCustomSchema: function() {
        const schemaText = $('#customSchema').val().trim();
        if (!schemaText) return;
        
        try {
            this.currentSchema = this.convertPydanticToSchema(schemaText);
        } catch (error) {
            console.warn('Schema parsing error:', error.message);
        }
    },
    
    convertPydanticToSchema: function(schemaText) {
        const lines = schemaText.split('\n').map(line => line.trim()).filter(line => line);
        const schema = { properties: {}, required: [] };
        
        for (const line of lines) {
            if (line.startsWith('class ') || line === '' || line.startsWith('#')) continue;
            
            const match = line.match(/^(\w+):\s*(.+?)(?:\s*=\s*(.+))?$/);
            if (match) {
                const [, fieldName, fieldType, defaultValue] = match;
                const isOptional = fieldType.includes('Optional') || defaultValue !== undefined;
                
                schema.properties[fieldName] = this.parseFieldType(fieldType);
                
                if (!isOptional && !defaultValue) {
                    schema.required.push(fieldName);
                }
            }
        }
        
        return schema;
    },
    
    parseFieldType: function(typeStr) {
        typeStr = typeStr.replace(/Optional\[(.+)\]/, '$1').replace(/List\[(.+)\]/, 'Array<$1>');
        
        const typeMap = {
            'str': { type: 'string' },
            'int': { type: 'integer' },
            'float': { type: 'number' },
            'bool': { type: 'boolean' },
            'Dict': { type: 'object' },
            'Any': {}
        };
        
        if (typeStr.startsWith('Array<')) {
            return { type: 'array', items: this.parseFieldType(typeStr.slice(6, -1)) };
        }
        
        return typeMap[typeStr] || { type: 'string' };
    },
    
    addCurrentCropAsRegion: function() {
        // Get current crop coordinates from JCrop
        const cropData = this.getCurrentCropCoordinates();
        if (!cropData) {
            this.showNotification('Please select a region on the image first.', 'error');
            return;
        }
        
        const region = {
            id: Date.now(),
            coordinates: cropData,
            imageUrl: this.generateRegionImageUrl(cropData),
            transcription: null,
            timestamp: new Date().toISOString()
        };
        
        this.regions.push(region);
        this.updateRegionCount();
        this.renderRegions();
        
        this.showNotification(`Region ${this.regions.length} added successfully!`, 'success');
    },
    
    getCurrentCropCoordinates: function() {
        // Get coordinates from the crop input fields
        const x = parseInt($('#crop-x').val()) || 0;
        const y = parseInt($('#crop-y').val()) || 0;
        const w = parseInt($('#crop-w').val()) || 0;
        const h = parseInt($('#crop-h').val()) || 0;
        
        if (w === 0 || h === 0) {
            return null;
        }
        
        // Convert display coordinates to actual image coordinates
        const multiplier = parseFloat($('#multiplier').val()) || 1;
        
        return {
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(w),
            height: Math.round(h),
            displayX: Math.round(x / multiplier),
            displayY: Math.round(y / multiplier),
            displayWidth: Math.round(w / multiplier),
            displayHeight: Math.round(h / multiplier)
        };
    },
    
    generateRegionImageUrl: function(coordinates) {
        const currentImageURL = window.currentImageID || getParameterByName('imageID');
        if (!currentImageURL) return null;
        
        const region = `${coordinates.x},${coordinates.y},${coordinates.width},${coordinates.height}`;
        return `${currentImageURL}/${region}/400,/0/default.jpg`;
    },
    
    renderRegions: function() {
        const container = $('#regionsContainer');
        
        if (this.regions.length === 0) {
            container.html(`
                <p style="color: #6b7280; text-align: center; margin-top: 50px;">
                    No regions selected yet.<br>
                    Crop an area above and click "Add Current Crop as Region"
                </p>
            `);
            return;
        }
        
        let html = '';
        this.regions.forEach((region, index) => {
            const selectedClass = region.id === this.selectedRegionId ? 'selected' : '';
            html += `
                <div class="region-item ${selectedClass}" data-region-id="${region.id}" onclick="aiTranscription.selectRegion(${region.id})">
                    <img src="${region.imageUrl}" alt="Region ${index + 1}" class="region-image" />
                    <div class="region-info">
                        <strong>Region ${index + 1}</strong><br>
                        Position: ${region.coordinates.x}, ${region.coordinates.y}<br>
                        Size: ${region.coordinates.width} × ${region.coordinates.height}px<br>
                        ${region.transcription ? '<span style="color: #059669;">✓ Transcribed</span>' : '<span style="color: #6b7280;">Pending</span>'}
                    </div>
                </div>
            `;
        });
        
        container.html(html);
    },
    
    selectRegion: function(regionId) {
        this.selectedRegionId = regionId;
        
        // Update region selection in all views
        $('.region-item').removeClass('selected');
        $(`.region-item[data-region-id="${regionId}"]`).addClass('selected');
        
        // Enable transcribe selected button
        $('#transcribeSelectedBtn').prop('disabled', false);
        
        this.renderTranscriptions();
    },
    
    renderTranscriptions: function() {
        const container = $('#transcriptionsContainer');
        
        const transcribedRegions = this.regions.filter(r => r.transcription);
        if (transcribedRegions.length === 0) {
            container.html(`
                <p style="color: #6b7280; text-align: center; margin-top: 50px;">
                    Transcriptions will appear here after AI processing.
                </p>
            `);
            return;
        }
        
        let html = '';
        transcribedRegions.forEach((region, index) => {
            const regionIndex = this.regions.findIndex(r => r.id === region.id) + 1;
            html += `
                <div class="transcription-item">
                    <div class="transcription-header">
                        <strong>Region ${regionIndex}</strong>
                        <small style="color: #6b7280;">${new Date(region.timestamp).toLocaleString()}</small>
                    </div>
                    <div class="transcription-content">
                        <textarea class="transcription-text" 
                                  data-region-id="${region.id}"
                                  onchange="aiTranscription.updateTranscription(${region.id}, this.value)">${JSON.stringify(region.transcription, null, 2)}</textarea>
                        <div class="transcription-actions">
                            <button class="btn-sm btn-success" onclick="aiTranscription.saveTranscription(${region.id})">
                                💾 Save
                            </button>
                            <button class="btn-sm btn-info" onclick="aiTranscription.retranscribeRegion(${region.id})">
                                🔄 Re-transcribe
                            </button>
                            <button class="btn-sm btn-danger" onclick="aiTranscription.deleteTranscription(${region.id})">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.html(html);
    },
    
    async transcribeSelectedRegion() {
        if (!this.selectedRegionId) {
            this.showNotification('Please select a region first.', 'error');
            return;
        }
        
        const region = this.regions.find(r => r.id === this.selectedRegionId);
        if (!region) return;
        
        await this.transcribeRegion(region);
    },
    
    async transcribeAllRegions() {
        if (this.regions.length === 0) {
            this.showNotification('No regions to transcribe.', 'error');
            return;
        }
        
        this.setProcessingStatus(true);
        
        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];
            this.updateTranscriptionStatus(`Processing region ${i + 1}/${this.regions.length}...`);
            
            try {
                await this.transcribeRegion(region);
                // Small delay between requests to avoid rate limits
                if (i < this.regions.length - 1) {
                    await this.delay(1000);
                }
            } catch (error) {
                console.error(`Error transcribing region ${i + 1}:`, error);
            }
        }
        
        this.setProcessingStatus(false);
        this.updateTranscriptionStatus('Ready');
        this.showNotification('All regions processed!', 'success');
    },
    
    async transcribeRegion(region) {
        try {
            this.setProcessingStatus(true);
            this.updateTranscriptionStatus('Calling Vertex AI...');
            
            const transcription = await this.callVertexAI(region.imageUrl);
            region.transcription = transcription;
            region.timestamp = new Date().toISOString();
            
            this.renderRegions();
            this.renderTranscriptions();
            
            this.showNotification('Transcription completed!', 'success');
        } catch (error) {
            this.showNotification(`Transcription failed: ${error.message}`, 'error');
        } finally {
            this.setProcessingStatus(false);
            this.updateTranscriptionStatus('Ready');
        }
    },
    
    async callVertexAI(imageUrl) {
        const projectId = $('#aiProjectId').val().trim();
        const location = $('#aiLocation').val();
        const model = $('#aiModel').val();
        const accessToken = $('#aiAccessToken').val().trim();
        const customPrompt = $('#customPrompt').val().trim();
        
        if (!projectId || !accessToken) {
            throw new Error('Please configure your Vertex AI settings.');
        }
        
        const baseUrl = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/endpoints/openapi`;
        
        // Fetch the image and convert to base64
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error('Failed to fetch region image');
        }
        
        const imageBlob = await imageResponse.blob();
        const imageBase64 = await this.blobToBase64(imageBlob);
        
        let promptText = customPrompt;
        if (!promptText && this.currentSchema) {
            promptText = `Analyze this image and extract structured data that matches this schema. Use null for fields that are not present in the image. For list fields, use an empty list [] if no values are present:

Schema: ${JSON.stringify(this.currentSchema, null, 2)}

Focus on extracting text, identifying any entities, dates, locations, and relevant keywords from the image content.`;
        }
        
        if (!promptText) {
            promptText = "Transcribe any text visible in this image and provide a detailed description of what you see.";
        }
        
        const content = [
            {
                type: "text",
                text: promptText + "\n\nOnly output valid JSON, nothing else."
            },
            { 
                type: "image_url", 
                image_url: {
                    url: `data:image/jpeg;base64,${imageBase64.split(',')[1]}`
                }
            }
        ];
        
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "user",
                    content: content
                }],
                max_tokens: 4000,
                temperature: 0.5,
                response_format: {
                    type: "json_object"
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vertex AI API call failed: ${response.status} ${response.statusText}\n${errorText}`);
        }
        
        const data = await response.json();
        const responseText = data.choices[0].message.content;
        
        // Clean and parse the response
        const cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        try {
            return JSON.parse(cleanedResponse);
        } catch (error) {
            throw new Error(`Failed to parse JSON response: ${cleanedResponse}`);
        }
    },
    
    blobToBase64: function(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    },
    
    updateTranscription: function(regionId, newValue) {
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            try {
                region.transcription = JSON.parse(newValue);
            } catch (error) {
                // If JSON parsing fails, store as text
                region.transcription = { text: newValue };
            }
        }
    },
    
    saveTranscription: function(regionId) {
        const textarea = $(`.transcription-text[data-region-id="${regionId}"]`);
        this.updateTranscription(regionId, textarea.val());
        this.showNotification('Transcription saved!', 'success');
    },
    
    async retranscribeRegion(regionId) {
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            await this.transcribeRegion(region);
        }
    },
    
    deleteTranscription: function(regionId) {
        const region = this.regions.find(r => r.id === regionId);
        if (region) {
            region.transcription = null;
            this.renderRegions();
            this.renderTranscriptions();
            this.showNotification('Transcription deleted.', 'success');
        }
    },
    
    clearAllRegions: function() {
        if (this.regions.length === 0) return;
        
        if (confirm('Are you sure you want to clear all regions and transcriptions?')) {
            this.regions = [];
            this.selectedRegionId = null;
            this.updateRegionCount();
            this.renderRegions();
            this.renderTranscriptions();
            $('#transcribeSelectedBtn').prop('disabled', true);
            this.showNotification('All regions cleared.', 'success');
        }
    },
    
    showExportModal: function() {
        const exportData = this.generateExportData();
        $('#exportJsonContent').text(JSON.stringify(exportData, null, 2));
        $('#exportModal').show();
    },
    
    closeExportModal: function() {
        $('#exportModal').hide();
    },
    
    generateExportData: function() {
        const currentImageURL = window.currentImageID || getParameterByName('imageID');
        
        return {
            metadata: {
                exportDate: new Date().toISOString(),
                imageUrl: currentImageURL,
                totalRegions: this.regions.length,
                transcribedRegions: this.regions.filter(r => r.transcription).length,
                schema: this.currentSchema
            },
            regions: this.regions.map((region, index) => ({
                regionId: region.id,
                regionNumber: index + 1,
                coordinates: {
                    original: {
                        x: region.coordinates.x,
                        y: region.coordinates.y,
                        width: region.coordinates.width,
                        height: region.coordinates.height
                    },
                    display: {
                        x: region.coordinates.displayX,
                        y: region.coordinates.displayY,
                        width: region.coordinates.displayWidth,
                        height: region.coordinates.displayHeight
                    }
                },
                imageUrl: region.imageUrl,
                transcription: region.transcription,
                timestamp: region.timestamp
            }))
        };
    },
    
    copyExportJson: function() {
        const content = $('#exportJsonContent').text();
        navigator.clipboard.writeText(content).then(() => {
            this.showNotification('JSON copied to clipboard!', 'success');
        });
    },
    
    downloadExportJson: function() {
        const exportData = this.generateExportData();
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iiif-transcription-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('JSON file downloaded!', 'success');
    },
    
    // UI Helper functions
    updateRegionCount: function() {
        $('#regionCount').text(`${this.regions.length} Regions`);
    },
    
    setProcessingStatus: function(isProcessing) {
        this.isProcessing = isProcessing;
        
        // Update button states
        $('#addRegionBtn, #transcribeSelectedBtn, #transcribeAllBtn, #clearAllBtn, #exportJsonBtn')
            .prop('disabled', isProcessing);
        
        // Update status indicator
        const statusEl = $('#transcriptionStatus');
        if (isProcessing) {
            statusEl.removeClass('status-ready status-error').addClass('status-processing')
                   .html('<span class="loading-spinner"></span> Processing');
        } else {
            statusEl.removeClass('status-processing status-error').addClass('status-ready')
                   .text('Ready');
        }
    },
    
    updateTranscriptionStatus: function(message) {
        if (this.isProcessing) {
            $('#transcriptionStatus').html(`<span class="loading-spinner"></span> ${message}`);
        }
    },
    
    showNotification: function(message, type = 'info') {
        // Create or update notification
        let notification = $('#ai-notification');
        if (notification.length === 0) {
            notification = $(`
                <div id="ai-notification" style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    z-index: 10000;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    max-width: 300px;
                "></div>
            `);
            $('body').append(notification);
        }
        
        // Set styles based on type
        const styles = {
            success: { background: '#d1fae5', color: '#065f46', border: '1px solid #059669' },
            error: { background: '#fee2e2', color: '#991b1b', border: '1px solid #dc2626' },
            info: { background: '#e6f3ff', color: '#0c4a6e', border: '1px solid #286dc0' }
        };
        
        const style = styles[type] || styles.info;
        notification.css(style).text(message).fadeIn();
        
        // Auto-hide after 4 seconds
        setTimeout(() => {
            notification.fadeOut();
        }, 4000);
    },
    
    delay: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Global functions for window scope
window.aiTranscription = aiTranscription;
window.closeExportModal = () => aiTranscription.closeExportModal();
window.copyExportJson = () => aiTranscription.copyExportJson();
window.downloadExportJson = () => aiTranscription.downloadExportJson();

// Function to get URL parameters (needed for compatibility)
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return results[2].replace(/\+/g, "%20");
}

// Initialize when document is ready
$(document).ready(function() {
    aiTranscription.init();
});