/*
 * aiTranscription.js: AI-powered transcription functionality for IIIF images
 * Integrates with Vertex AI and supports custom Pydantic schemas
 */

var aiTranscription = {
    regions: [],
    selectedRegionId: null,
    currentSchema: null,
    isProcessing: false,
    editingRegion: null,
    hasUnsavedChanges: false,
    originalTranscription: null,
    
    init: function() {
        this.setupEventListeners();
        this.loadDefaultSchema();
        this.showWorkspaceWhenImageLoaded();
        this.createRegionViewerModal();
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
        
        // Region viewer modal events
        $(document).on('click', '#regionViewerClose', () => this.closeRegionViewer());
        $(document).on('click', '#regionViewerTranscribe', () => this.transcribeCurrentRegion());
        $(document).on('click', '#regionViewerSave', () => this.saveRegionChanges());
        $(document).on('change input', '.field-editor', () => this.markUnsavedChanges());
        $(document).on('click', '.field-selector-btn', (e) => this.selectField(e.target.dataset.field));
    },
    
    createRegionViewerModal: function() {
        const modalHtml = `
            <div id="regionViewerModal" class="modal" style="display: none;">
                <div class="modal-content" style="width: 95%; max-width: 1200px; height: 80vh;">
                    <div class="modal-header">
                        <h3 id="regionViewerTitle">Edit Region Transcription</h3>
                        <button id="regionViewerClose" class="close">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 0; height: calc(80vh - 120px); display: flex;">
                        <!-- Left side: Cropped image -->
                        <div style="flex: 1; padding: 20px; border-right: 2px solid #e2e8f0; display: flex; flex-direction: column;">
                            <h4 style="margin: 0 0 15px 0; color: #374151;">Cropped Region</h4>
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                                <img id="regionViewerImage" src="" alt="Region" style="max-width: 100%; max-height: 100%; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            </div>
                            <div id="regionViewerInfo" style="margin-top: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px; font-size: 12px; color: #6b7280;">
                                <!-- Region info will be populated here -->
                            </div>
                        </div>
                        
                        <!-- Right side: Field editor -->
                        <div style="flex: 1; padding: 20px; display: flex; flex-direction: column;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                                <h4 style="margin: 0; color: #374151;">Transcription Data</h4>
                                <div>
                                    <button id="regionViewerTranscribe" class="btn btn-primary btn-sm" style="margin-right: 8px; background: #059669;">
                                        🤖 Transcribe Region
                                    </button>
                                    <button id="regionViewerSave" class="btn btn-success btn-sm" style="margin-right: 8px;">
                                        💾 Save Changes
                                    </button>
                                    <span id="unsavedIndicator" style="display: none; color: #dc2626; font-size: 12px; font-weight: 600;">
                                        ● Unsaved changes
                                    </span>
                                </div>
                            </div>
                            
                            <!-- Field selector -->
                            <div id="fieldSelector" style="margin-bottom: 15px;">
                                <p style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">Select field to edit:</p>
                                <div id="fieldButtons" style="display: flex; flex-wrap: wrap; gap: 6px;">
                                    <!-- Field buttons will be populated here -->
                                </div>
                            </div>
                            
                            <!-- Field editor -->
                            <div style="flex: 1; display: flex; flex-direction: column;">
                                <div id="currentFieldLabel" style="font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
                                    Select a field to edit
                                </div>
                                <div id="fieldEditorContainer" style="flex: 1; position: relative;">
                                    <div id="noFieldSelected" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af; font-style: italic;">
                                        Click a field button above to start editing
                                    </div>
                                    <textarea id="fieldEditor" class="field-editor transcription-text" style="display: none; width: 100%; height: 100%; resize: none; font-size: 13px; font-family: 'Courier New', monospace;" placeholder="Enter field value..."></textarea>
                                </div>
                            </div>
                            
                            <!-- Raw JSON view toggle -->
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                                <button id="toggleRawJson" class="btn btn-info btn-sm" style="font-size: 11px;">
                                    📄 Toggle Raw JSON View
                                </button>
                                <textarea id="rawJsonEditor" class="field-editor" style="display: none; width: 100%; height: 150px; margin-top: 10px; font-size: 11px; font-family: 'Courier New', monospace;" placeholder="Raw JSON data..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(modalHtml);
        
        // Add toggle functionality for raw JSON
        $(document).on('click', '#toggleRawJson', () => this.toggleRawJsonView());
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
        const defaultSchema = `class Transcription(BaseModel):
    text: str`;
        
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
                <div class="region-item ${selectedClass}" data-region-id="${region.id}" onclick="aiTranscription.openRegionViewer(${region.id})">
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
    
    openRegionViewer: function(regionId) {
        const region = this.regions.find(r => r.id === regionId);
        if (!region) return;
        
        this.editingRegion = region;
        this.originalTranscription = region.transcription ? JSON.parse(JSON.stringify(region.transcription)) : null;
        this.hasUnsavedChanges = false;
        
        // Set up the modal
        $('#regionViewerTitle').text(`Edit Region ${this.regions.findIndex(r => r.id === regionId) + 1} Transcription`);
        $('#regionViewerImage').attr('src', region.imageUrl);
        $('#regionViewerInfo').html(`
            <strong>Position:</strong> ${region.coordinates.x}, ${region.coordinates.y}<br>
            <strong>Size:</strong> ${region.coordinates.width} × ${region.coordinates.height}px<br>
            <strong>Last modified:</strong> ${region.timestamp ? new Date(region.timestamp).toLocaleString() : 'Never'}
        `);
        
        // Set up field buttons and editor
        this.setupFieldEditor(region);
        
        // Show the modal
        $('#regionViewerModal').show();
        this.updateUnsavedIndicator();
    },
    
    setupFieldEditor: function(region) {
        const transcription = region.transcription || {};
        const fieldButtons = $('#fieldButtons');
        const rawJsonEditor = $('#rawJsonEditor');
        
        // Create field buttons based on schema or existing data
        fieldButtons.empty();
        const fields = new Set();
        
        // Add fields from schema
        if (this.currentSchema && this.currentSchema.properties) {
            Object.keys(this.currentSchema.properties).forEach(field => fields.add(field));
        }
        
        // Add fields from existing transcription
        if (transcription) {
            Object.keys(transcription).forEach(field => fields.add(field));
        }
        
        // If no fields, add default ones
        if (fields.size === 0) {
            ['text', 'confidence', 'language', 'entities'].forEach(field => fields.add(field));
        }
        
        // Create buttons
        Array.from(fields).sort().forEach(field => {
            const value = transcription[field];
            const hasValue = value !== undefined && value !== null && value !== '';
            const buttonClass = hasValue ? 'btn-success' : 'btn-outline-secondary';
            
            fieldButtons.append(`
                <button class="btn ${buttonClass} btn-sm field-selector-btn" data-field="${field}" style="font-size: 11px;">
                    ${field} ${hasValue ? '✓' : ''}
                </button>
            `);
        });
        
        // Set up raw JSON editor
        rawJsonEditor.val(JSON.stringify(transcription, null, 2));
        
        // Auto-select the first field if any fields exist
        const sortedFields = Array.from(fields).sort();
        if (sortedFields.length > 0) {
            // Select the first field automatically
            this.selectField(sortedFields[0]);
        } else {
            // Reset editor state if no fields
            $('#fieldEditor').hide().val('');
            $('#noFieldSelected').show();
            $('#currentFieldLabel').text('Select a field to edit');
        }
        
        $('#rawJsonEditor').hide();
    },
    
    selectField: function(fieldName) {
        const transcription = this.editingRegion.transcription || {};
        const value = transcription[fieldName];
        
        // Update UI
        $('#currentFieldLabel').text(`Editing: ${fieldName}`);
        $('#noFieldSelected').hide();
        $('#fieldEditor').show().val(this.formatFieldValue(value)).focus();
        
        // Update button states
        $('.field-selector-btn').removeClass('btn-primary').addClass(function() {
            return $(this).hasClass('btn-success') ? 'btn-success' : 'btn-outline-secondary';
        });
        $(`.field-selector-btn[data-field="${fieldName}"]`).removeClass('btn-success btn-outline-secondary').addClass('btn-primary');
        
        // Store current field
        $('#fieldEditor').data('current-field', fieldName);
    },
    
    formatFieldValue: function(value) {
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) {
            // Join array items with commas, preserving any line breaks within items
            return value.join(', ');
        }
        if (typeof value === 'object') return JSON.stringify(value, null, 2);
        // Preserve line breaks in string values
        return String(value);
    },
    
    parseFieldValue: function(value, fieldName) {
        if (!value || value.trim() === '') return null;
        
        // Check if it's supposed to be an array based on schema
        if (this.currentSchema && this.currentSchema.properties && this.currentSchema.properties[fieldName]) {
            const fieldSchema = this.currentSchema.properties[fieldName];
            if (fieldSchema.type === 'array') {
                // For arrays, split on commas but preserve internal whitespace (including line breaks)
                return value.split(',').map(item => {
                    // Only trim leading/trailing spaces, not newlines
                    return item.replace(/^[ \t]+|[ \t]+$/g, '');
                }).filter(item => item);
            }
            if (fieldSchema.type === 'number') {
                const num = parseFloat(value);
                return isNaN(num) ? null : num;
            }
            if (fieldSchema.type === 'integer') {
                const num = parseInt(value);
                return isNaN(num) ? null : num;
            }
            if (fieldSchema.type === 'boolean') {
                return value.toLowerCase() === 'true';
            }
        }
        
        // Try to parse as JSON for objects
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                // If JSON parsing fails, return as string
            }
        }
        
        return value;
    },
    
    markUnsavedChanges: function() {
        this.hasUnsavedChanges = true;
        this.updateUnsavedIndicator();
        
        // If editing a specific field, update the transcription object
        const currentField = $('#fieldEditor').data('current-field');
        if (currentField) {
            const fieldValue = $('#fieldEditor').val();
            const parsedValue = this.parseFieldValue(fieldValue, currentField);
            
            if (!this.editingRegion.transcription) {
                this.editingRegion.transcription = {};
            }
            
            this.editingRegion.transcription[currentField] = parsedValue;
            
            // Update raw JSON editor
            $('#rawJsonEditor').val(JSON.stringify(this.editingRegion.transcription, null, 2));
            
            // Update field button
            const hasValue = parsedValue !== null && parsedValue !== undefined && parsedValue !== '';
            const button = $(`.field-selector-btn[data-field="${currentField}"]`);
            button.html(`${currentField} ${hasValue ? '✓' : ''}`);
            if (hasValue && !button.hasClass('btn-primary')) {
                button.removeClass('btn-outline-secondary').addClass('btn-success');
            }
        }
        
        // Handle raw JSON changes
        if ($(event.target).is('#rawJsonEditor')) {
            try {
                const jsonData = JSON.parse($('#rawJsonEditor').val());
                this.editingRegion.transcription = jsonData;
                
                // Update field buttons
                this.setupFieldEditor(this.editingRegion);
            } catch (e) {
                // Invalid JSON, don't update
            }
        }
    },
    
    updateUnsavedIndicator: function() {
        if (this.hasUnsavedChanges) {
            $('#unsavedIndicator').show();
            $('#regionViewerSave').prop('disabled', false);
        } else {
            $('#unsavedIndicator').hide();
            $('#regionViewerSave').prop('disabled', true);
        }
    },
    
    saveRegionChanges: function() {
        if (!this.editingRegion) return;
        
        // Update timestamp
        this.editingRegion.timestamp = new Date().toISOString();
        
        // Mark as saved
        this.hasUnsavedChanges = false;
        this.updateUnsavedIndicator();
        this.originalTranscription = this.editingRegion.transcription ? JSON.parse(JSON.stringify(this.editingRegion.transcription)) : null;
        
        // Update the main UI
        this.renderRegions();
        this.renderTranscriptions();
        
        this.showNotification('Region transcription saved!', 'success');
    },
    
    closeRegionViewer: function() {
        if (this.hasUnsavedChanges) {
            if (confirm('You have unsaved changes. Do you want to save before closing?')) {
                this.saveRegionChanges();
            } else {
                // Revert changes
                this.editingRegion.transcription = this.originalTranscription ? JSON.parse(JSON.stringify(this.originalTranscription)) : null;
            }
        }
        
        $('#regionViewerModal').hide();
        this.editingRegion = null;
        this.hasUnsavedChanges = false;
        this.originalTranscription = null;
    },
    
    toggleRawJsonView: function() {
        const rawJsonEditor = $('#rawJsonEditor');
        if (rawJsonEditor.is(':visible')) {
            rawJsonEditor.hide();
            $('#toggleRawJson').text('📄 Toggle Raw JSON View');
        } else {
            rawJsonEditor.show().focus();
            $('#toggleRawJson').text('📄 Hide Raw JSON View');
        }
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
                    Transcriptions will appear here after AI processing.<br>
                    <small>Click on a region to edit its transcription.</small>
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
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 12px; line-height: 1.4; max-height: 150px; overflow-y: auto;">
                            ${this.formatTranscriptionPreview(region.transcription)}
                        </div>
                        <div class="transcription-actions" style="margin-top: 8px;">
                            <button class="btn-sm btn-info" onclick="aiTranscription.openRegionViewer(${region.id})">
                                ✏️ Edit
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
    
    formatTranscriptionPreview: function(transcription) {
        if (!transcription) return '<em>No transcription data</em>';
        
        let preview = '';
        Object.entries(transcription).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const displayValue = Array.isArray(value) ? value.join(', ') : 
                                  typeof value === 'object' ? JSON.stringify(value) : String(value);
                const truncatedValue = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;
                preview += `<strong>${key}:</strong> ${truncatedValue}<br>`;
            }
        });
        
        return preview || '<em>No data</em>';
    },
    
    async transcribeCurrentRegion() {
        if (!this.editingRegion) {
            this.showNotification('No region is currently being edited.', 'error');
            return;
        }
        
        // The editingRegion is already the region object, use it directly
        const region = this.editingRegion;
        
        // Transcribe the region
        await this.transcribeRegion(region);
        
        // Refresh the popup viewer with new data
        this.openRegionViewer(this.editingRegion.id);
        
        // Show success message
        this.showNotification('🤖 Region transcribed successfully!', 'success');
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
            
            const provider = $('#aiProvider').val();
            console.log('Selected AI provider:', provider);
            let transcription;
            
            if (provider === 'vertex') {
                this.updateTranscriptionStatus('Calling Vertex AI...');
                transcription = await this.callVertexAI(region.imageUrl);
            } else if (provider === 'huggingface') {
                this.updateTranscriptionStatus('Calling HuggingFace...');
                console.log('About to call HuggingFace API...');
                transcription = await this.callHuggingFace(region.imageUrl);
                console.log('HuggingFace API returned:', transcription);
            } else {
                throw new Error(`Unknown AI provider selected: ${provider}`);
            }
            
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
            promptText = `Provide a single value for the field text.Analyze this image and extract structured data that matches this schema. Use null for fields that are not present in the image. For list fields, use an empty list [] if no values are present:

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
        
        // Clean and parse the response (preserve internal whitespace)
        let cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '');
        // Only trim leading/trailing spaces, not newlines
        cleanedResponse = cleanedResponse.replace(/^[ \t]+|[ \t]+$/gm, '');
        
        try {
            return JSON.parse(cleanedResponse);
        } catch (error) {
            throw new Error(`Failed to parse JSON response: ${cleanedResponse}`);
        }
    },
    
    async callHuggingFace(imageUrl) {
        const endpoint = $('#hfEndpoint').val().trim();
        const model = $('#hfModel').val();
        const hfToken = $('#hfToken').val().trim();
        const customPrompt = $('#customPrompt').val().trim();
        
        if (!endpoint) {
            throw new Error('Please configure your HuggingFace endpoint.');
        }
        
        if (!hfToken) {
            throw new Error('Please provide your HuggingFace token.');
        }
        
        console.log('HuggingFace call initiated:', { endpoint, model, imageUrl, hasToken: !!hfToken });
        
        let promptText = customPrompt;
        
        // Model-specific prompt handling
        const isOldChurchSlavonic = model.includes('old-church-slavonic');
        console.log('Using model:', model, 'Is Old Church Slavonic:', isOldChurchSlavonic);
        
        if (!promptText && this.currentSchema) {
            if (isOldChurchSlavonic) {
                // Simplified prompt for specialized model
                promptText = `Transcribe the text in this image. Extract the text exactly as it appears, preserving any Old Church Slavonic characters and formatting. Return the result as JSON with a "text" field containing the transcription.`;
            } else {
                promptText = `Analyze this image and extract structured data that matches this schema. Use null for fields that are not present in the image. For list fields, use an empty list [] if no values are present:

Schema: ${JSON.stringify(this.currentSchema, null, 2)}

Focus on extracting text, identifying any entities, dates, locations, and relevant keywords from the image content. Return valid JSON only.`;
            }
        }
        
        if (!promptText) {
            if (isOldChurchSlavonic) {
                promptText = "Transcribe the Old Church Slavonic text in this image exactly as it appears.";
            } else {
                promptText = "Convert the image to text.";
            }
        }
        
        console.log('Using prompt:', promptText);
        
        // Step 1: Initiate the transcription
        const requestBody = {
            data: [
                {
                    path: imageUrl,
                    meta: { _type: "gradio.FileData" }
                },
                model,
                promptText
            ]
        };
        
        console.log('HuggingFace request body:', JSON.stringify(requestBody, null, 2));
        
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (hfToken) {
            headers['Authorization'] = `Bearer ${hfToken}`;
        }
        
        const initiateResponse = await fetch(`${endpoint}/gradio_api/call/transcribe`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        
        if (!initiateResponse.ok) {
            const errorText = await initiateResponse.text();
            console.error('HuggingFace initiation error:', errorText);
            throw new Error(`HuggingFace API initiation failed: ${initiateResponse.status} ${initiateResponse.statusText}`);
        }
        
        const initiateData = await initiateResponse.json();
        console.log('HuggingFace initiation response:', initiateData);
        
        const eventId = initiateData.event_id;
        
        if (!eventId) {
            throw new Error('Failed to get event ID from HuggingFace API');
        }
        
        console.log('Got event ID:', eventId);
        
        // Step 2: Poll for the result
        let attempts = 0;
        // Longer timeout for specialized models
        const maxAttempts = isOldChurchSlavonic ? 120 : 60; // 2 minutes for Old Church Slavonic, 1 minute for others
        console.log(`Using ${maxAttempts} second timeout for model: ${model}`);
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            attempts++;
            
            try {
                console.log(`Polling attempt ${attempts}/${maxAttempts} for event ${eventId}`);
                
                const pollHeaders = {};
                if (hfToken) {
                    pollHeaders['Authorization'] = `Bearer ${hfToken}`;
                }
                
                const resultResponse = await fetch(`${endpoint}/gradio_api/call/transcribe/${eventId}`, {
                    headers: pollHeaders
                });
                
                if (!resultResponse.ok) {
                    console.warn(`Poll attempt ${attempts} failed: ${resultResponse.status} ${resultResponse.statusText}`);
                    continue;
                }
                
                const resultText = await resultResponse.text();
                console.log(`Poll attempt ${attempts} response:`, resultText);
                
                // Special logging for Old Church Slavonic model
                if (isOldChurchSlavonic) {
                    console.log('Old Church Slavonic model raw response length:', resultText.length);
                    console.log('Old Church Slavonic model response preview:', resultText.substring(0, 200));
                }
                
                if (!resultText.trim()) {
                    console.log('Empty response, continuing to poll...');
                    continue;
                }
                
                const lines = resultText.split('\n');
                
                // Look for the final result line
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonString = line.substring(6);
                            console.log('Parsing data line:', jsonString);
                            
                            const data = JSON.parse(jsonString);
                            console.log('Parsed data:', data);
                            
                            if (data && Array.isArray(data) && data.length > 0) {
                                const result = data[0];
                                console.log('Got result:', result);
                                
                                if (typeof result === 'string' && result.trim()) {
                                    // Clean markdown formatting from response (preserve line breaks)
                                    let cleanedResult = result;
                                    
                                    // Remove markdown code blocks (preserve internal whitespace)
                                    cleanedResult = cleanedResult.replace(/^```json\s*/i, '');
                                    cleanedResult = cleanedResult.replace(/\s*```\s*$/, '');
                                    // Only trim spaces/tabs, not newlines
                                    cleanedResult = cleanedResult.replace(/^[ \t]+|[ \t]+$/gm, '');
                                    
                                    console.log('Cleaned result:', cleanedResult);
                                    
                                    // Try to parse as JSON, fallback to text
                                    try {
                                        const parsedResult = JSON.parse(cleanedResult);
                                        console.log('Parsed JSON result:', parsedResult);
                                        return parsedResult;
                                    } catch (e) {
                                        console.log('JSON parsing failed, using text result:', cleanedResult);
                                        
                                        // For Old Church Slavonic model, create a structured response
                                        if (model && model.includes('old-church-slavonic')) {
                                            console.log('Handling Old Church Slavonic model response as plain text');
                                            return { 
                                                text: cleanedResult,
                                                language: "Old Church Slavonic",
                                                confidence: 0.8 
                                            };
                                        }
                                        
                                        return { text: cleanedResult };
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse line:', line, 'Error:', e);
                        }
                                            }
                    }
                    
                    // Special handling for Old Church Slavonic model - look for any text content
                    if (isOldChurchSlavonic && resultText.trim()) {
                        console.log('Old Church Slavonic: Checking for any text content in response');
                        
                        // Try to find any meaningful text in the response
                        const lines = resultText.split('\n');
                        for (const line of lines) {
                            const trimmedLine = line.trim();
                            if (trimmedLine && !trimmedLine.startsWith('data:') && !trimmedLine.startsWith('event:')) {
                                console.log('Old Church Slavonic: Found potential text content:', trimmedLine);
                                try {
                                    // Try parsing as JSON first
                                    const parsed = JSON.parse(trimmedLine);
                                    return parsed;
                                } catch {
                                    // If not JSON, treat as plain text
                                    if (trimmedLine.length > 5) { // Reasonable text length
                                        return { 
                                            text: trimmedLine,
                                            language: "Old Church Slavonic",
                                            confidence: 0.7 
                                        };
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Attempt ${attempts} failed:`, error);
                }
            }
        
        // Enhanced error message for Old Church Slavonic model
        const errorMsg = isOldChurchSlavonic 
            ? 'Old Church Slavonic model timed out. The specialized model may need more time or have different output format.'
            : 'HuggingFace API timed out waiting for result';
        throw new Error(errorMsg);
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