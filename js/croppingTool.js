/*
 * croppingTool.js: manipulate images served via IIIF Image API via controls linked to IIIF parameters
 *   makes use of JCrop library for visual selection of image region & MagnificPopup for image preview
 *
 * J B Howard - john.b.howard@ucd.ie - @john_b_howard - https://github.com/jbhoward-dublin
 *
 */
var croptool = {
    
    /* initialise  */
    init: function () {
        this.crop();
    },
    
    crop: function () {
        
        var clipboard = new Clipboard('.btn');
        clipboard.on('success', function (e) {
            e.clearSelection();
            showTooltip(e.trigger, 'Copied!');
        });
        clipboard.on('error', function (e) {
            showTooltip(e.trigger, fallbackMessage(e.action));
        });
        function showTooltip(elem, msg) {
            $('.btn-copy-link').tooltip('hide');
            $('button.btn-copy-link').attr('data-placement', 'bottom');
            $('button.btn-copy-link').attr('data-original-title', msg);
            elem.setAttribute('aria-label', msg);
            $('.btn-copy-link').tooltip('show');
            $('button.btn-copy-link').attr('data-placement', 'right');
            $('button.btn-copy-link').attr('data-original-title', 'Copy link to clipboard');
            elem.setAttribute('aria-label', 'Copy link to clipboard');
        }
        
        /* page HTML */
        
        /* page intro: localise */
        var page_intro =
        '    <div class="crop-align">' +
        '        <div class="pull-left"><img src="img/ucd_logo_sm.png" style="max-height:24px;"></img></div>' +
        '        <h2>IIIF Image Manipulation Tool</h2>' +
        '        <h3>Crop, Re-size, and Transform Images</h3>' +
        '        <div class="panel panel-default">' +
        '            <div class="panel-body">' +
        '                <h4>Create custom images by cropping and re-sizing images for download or linking</h4>' +
        '                <p>Select all or portion of an image, then download it or create a persistent link.</p>' +
        '            </div>' +
        '        </div>' +
        
        /* form: enter image URL */
        
        '        <div class="panel panel-default">' +
        '            <div class="panel-heading">' +
        '                <h3 class="panel-title">Load IIIF Image</h3>' +
        '            </div>' +
        '            <div class="panel-body">' +
        '                <div class="input-group">' +
        '                    <input type="text" class="form-control iiif_link" id="iiif_link" placeholder="https://collections.library.yale.edu/iiif/2/32497081">' +
        '                    <span class="input-group-btn">' +
        '                        <button class="btn btn-primary" type="button" id="load_image_btn">Load Image <i class="fa fa-picture-o"></i></button>' +
        '                    </span>' +
        '                </div>' +
        '                <div id="load_status"></div>' +
        '            </div>' +
        '        </div>' +
        
        /* crop coordinates */
        '        <div class="panel panel-default">' +
        '            <div class="panel-heading">' +
        '                <h3 class="panel-title">1: Select Image Area</h3>' +
        '            </div>' +
        '            <div class="panel-body">' +
        '                <p>Use mouse to select area in the Crop Box or enter coordinates below.</p>' +
        '                <div class="row">' +
        '                    <div class="col-md-2">' +
        '                        <div class="form-group">' +
        '                            <label for="crop-x" class="control-label">X</label>' +
        '                            <input type="number" class="form-control" id="crop-x" placeholder="0">' +
        '                        </div>' +
        '                    </div>' +
        '                    <div class="col-md-2">' +
        '                        <div class="form-group">' +
        '                            <label for="crop-y" class="control-label">Y</label>' +
        '                            <input type="number" class="form-control" id="crop-y" placeholder="0">' +
        '                        </div>' +
        '                    </div>' +
        '                    <div class="col-md-2">' +
        '                        <div class="form-group">' +
        '                            <label for="crop-w" class="control-label">Width</label>' +
        '                            <input type="number" class="form-control" id="crop-w" placeholder="100">' +
        '                        </div>' +
        '                    </div>' +
        '                    <div class="col-md-2">' +
        '                        <div class="form-group">' +
        '                            <label for="crop-h" class="control-label">Height</label>' +
        '                            <input type="number" class="form-control" id="crop-h" placeholder="100">' +
        '                        </div>' +
        '                    </div>' +
        '                    <div class="col-md-4">' +
        '                        <div class="form-group">' +
        '                            <label for="full_image_btn" class="control-label">&nbsp;</label><br>' +
        '                            <button id="full_image_btn" class="btn btn-info btn-sm">Select entire image</button>' +
        '                        </div>' +
        '                    </div>' +
        '                </div>' +
        '            </div>' +
        '        </div>' +
        
        /* resize controls */
        '        <div class="panel panel-default">' +
        '            <div class="panel-heading">' +
        '                <h3 class="panel-title">2: Select Image Size</h3>' +
        '            </div>' +
        '            <div class="panel-body">' +
        '                <p class="image-options">Select output image width: ' +
        '                <button class="btn btn-default btn-sm" data-width="1280">1280px</button> ' +
        '                <button class="btn btn-default btn-sm" data-width="1024">1024px</button> ' +
        '                <button class="btn btn-default btn-sm" data-width="800">800px</button> ' +
        '                <button class="btn btn-default btn-sm" data-width="400">400px</button> ' +
        '                <button class="btn btn-default btn-sm" data-width="150">150px</button> ' +
        '                — other: <input type="number" id="custom-width" class="form-control" style="width: 80px; display: inline-block;" placeholder="width">' +
        '                </p>' +
        '                <p class="image-options">' +
        '                <label><input type="checkbox" id="square"> create a square image</label>' +
        '                </p>' +
        '                <p class="nowrap"><small>Tip: When downloading a full map sheet or very large image (width > 8000 pixels), select an output image value of 8000 or higher in the Other box. There is no need to add \'px\' to the end of the integer.</small></p>' +
        '            </div>' +
        '        </div>' +
        
        /* image format, rotation, quality */
        '        <div class="panel panel-default">' +
        '            <div class="panel-heading">' +
        '                <h3 class="panel-title">3: Select Image Options</h3>' +
        '            </div>' +
        '            <div class="panel-body">' +
        '                <p class="image-options">Select output image format: ' +
        '                <label class="radio-inline"><input type="radio" name="format" value="jpg" checked> JPEG</label> ' +
        '                <label class="radio-inline"><input type="radio" name="format" value="png"> PNG</label> ' +
        '                <label class="radio-inline"><input type="radio" name="format" value="gif"> GIF</label> ' +
        '                <label class="radio-inline"><input type="radio" name="format" value="tif"> TIFF</label>' +
        '                </p>' +
        '                <p class="image-options">Select output image rotation: ' +
        '                <label class="radio-inline"><input type="radio" name="rotation" value="0" checked> 0</label> ' +
        '                <label class="radio-inline"><input type="radio" name="rotation" value="90"> 90</label> ' +
        '                <label class="radio-inline"><input type="radio" name="rotation" value="180"> 180</label> ' +
        '                <label class="radio-inline"><input type="radio" name="rotation" value="270"> 270</label> ' +
        '                <label class="radio-inline"><input type="radio" name="rotation" value="!0"> mirror</label> rotation — other: ' +
        '                <input type="number" id="custom-rotation" class="form-control" style="width: 60px; display: inline-block;" placeholder="degrees">' +
        '                </p>' +
        '                <p class="image-options">Select output image quality: ' +
        '                <label class="radio-inline"><input type="radio" name="quality" value="default" checked> default</label> ' +
        '                <label class="radio-inline"><input type="radio" name="quality" value="color"> colour</label> ' +
        '                <label class="radio-inline"><input type="radio" name="quality" value="bitonal"> bitonal</label>' +
        '                </p>' +
        '            </div>' +
        '        </div>' +
        
        /* download or link */
        '        <div class="panel panel-default">' +
        '            <div class="panel-heading">' +
        '                <h3 class="panel-title">4: Save or Link the image</h3>' +
        '            </div>' +
        '            <div class="panel-body">' +
        '                <p>Click on the \'Preview this image\' button to open your image in a new window for download. Right click on the image to save to your computer.</p>' +
        '                <p>' +
        '                <button id="generate_image" class="btn btn-success">Preview this image <i class="fa fa-external-link"></i></button> ' +
        '                <button id="generate_iiif_link" class="btn btn-primary btn-copy-link" data-clipboard-target="#iiif_url_output">Copy link to clipboard <i class="fa fa-clipboard"></i></button>' +
        '                </p>' +
        '                <p>Or copy the URL below to create a persistent hyperlink to your custom image:</p>' +
        '                <div class="input-group">' +
        '                    <input type="text" class="form-control" id="iiif_url_output" readonly>' +
        '                    <span class="input-group-btn">' +
        '                        <button class="btn btn-default btn-copy-link" type="button" data-clipboard-target="#iiif_url_output"><i class="fa fa-clipboard"></i></button>' +
        '                    </span>' +
        '                </div>' +
        '            </div>' +
        '        </div>' +
        
        /* multiplier for jcrop coordinates */
        '        <input type="hidden" id="multiplier" value="1">' +
        
        '</div><!-- /crop-align -->';
        
        $('#cropping_tool').html(page_intro);
        
        function showLoadStatus() {
            $('#load_status').html('<div class="alert alert-info" role="alert"><i class="fa fa-spinner fa-spin"></i> Loading image...</div>');
        }
        
        function hideLoadStatus() {
            $('#load_status').html('<div class="alert alert-success" role="alert"><i class="fa fa-check"></i> Image loaded successfully!</div>');
            setTimeout(function() {
                $('#load_status').html('');
            }, 3000);
        }
        
        function showLoadError(message) {
            $('#load_status').html('<div class="alert alert-danger" role="alert"><i class="fa fa-exclamation-triangle"></i> Error: ' + message + '</div>');
        }
        
        function loadImageFromURL(imageURL) {
            if (!imageURL) {
                showLoadError('Please enter a valid IIIF image URL');
                return;
            }
            
            showLoadStatus();
            
            // Store the current image URL globally
            window.currentImageID = imageURL;
            
            // Try to load image info
            $.getJSON(imageURL + '/info.json')
                .done(function(info) {
                    // Image info loaded successfully
                    getImageData(info, imageURL);
                })
                .fail(function(xhr) {
                    showImageInfoLoadError(xhr.status);
                });
        }
        
        function showImageInfoLoadError(status_code) {
            var error_message = 'Failed to load image information';
            
            if (status_code === 400) {
                error_message = 'Bad Request: The image URL appears to be malformed';
            } else if (status_code === 401) {
                error_message = 'Unauthorized: You may need permission to access this image';
            } else if (status_code === 403) {
                error_message = 'Forbidden: Access to this image is not allowed';
            } else if (status_code === 404) {
                error_message = 'Not Found: This image does not exist or the URL is incorrect';
            } else if (status_code === 500) {
                error_message = 'Server Error: The image server is experiencing problems';
            }
            
            showLoadError(error_message);
        }
        
        function getParameterByName(name, url) {
            if (!url) url = window.location.href;
            name = name.replace(/[\[\]]/g, "\\$&");
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
                results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, " "));
        }
        
        function preload(arrayOfImages) {
            $(arrayOfImages).each(function(){
                $('<img/>')[0].src = this;
            });
        }
        
        function getImageData(result, imageURL) {
            
            function get_target_details() {
                
                var imageID = imageURL;
                var target_details = {};
                var multiplier = 1;
                var thisimage = result;
                
                target_details.id = thisimage.id || thisimage['@id'];
                target_details.width = thisimage.width;
                target_details.height = thisimage.height;
                
                var scale = 800;
                
                var view_width = scale;
                var view_height = Math.round((thisimage.height * scale) / thisimage.width);
                
                if (view_height > 600) {
                    view_height = 600;
                    view_width = Math.round((thisimage.width * 600) / thisimage.height);
                }
                
                target_details.view_width = view_width;
                target_details.view_height = view_height;
                
                multiplier = thisimage.width / view_width;
                
                $('#multiplier').val(multiplier);
                
                // Check if JCrop has been initialized and destroy it
                if ($('#target').data('Jcrop')) {
                    $('#target').data('Jcrop').destroy();
                }
                
                var target_image_src = target_details.id + '/full/' + view_width + ',/0/default.jpg';
                var target_image = '<img src="' + target_image_src + '" id="target" style="max-width: 100%;" />';
                
                $('#cropContainer').html(target_image);
                
                // Show the AI workspace when image loads
                $('#aiWorkspace').addClass('active');
                
                // Preload the image
                preload([target_image_src]);
                
                // Wait for image to load before initializing JCrop
                $('#target').on('load', function() {
                    hideLoadStatus();
                    setSelectJcrop();
                });
                
                // Set initial crop values
                $('#crop-x').val(0);
                $('#crop-y').val(0);
                $('#crop-w').val(Math.round(thisimage.width / 4));
                $('#crop-h').val(Math.round(thisimage.height / 4));
            }
            
            function setSelectJcrop() {
                
                var multiplier = parseFloat($('#multiplier').val());
                
                $('#target').Jcrop({
                    onChange: function(c) {
                        $('#crop-x').val(Math.round(c.x * multiplier));
                        $('#crop-y').val(Math.round(c.y * multiplier));
                        $('#crop-w').val(Math.round(c.w * multiplier));
                        $('#crop-h').val(Math.round(c.h * multiplier));
                        updateImageURL();
                    },
                    onSelect: function(c) {
                        $('#crop-x').val(Math.round(c.x * multiplier));
                        $('#crop-y').val(Math.round(c.y * multiplier));
                        $('#crop-w').val(Math.round(c.w * multiplier));
                        $('#crop-h').val(Math.round(c.h * multiplier));
                        updateImageURL();
                    },
                    boxWidth: 800,
                    boxHeight: 600
                });
                
                // Set initial selection
                var jcrop_api = $('#target').data('Jcrop');
                var init_w = Math.round(parseInt($('#crop-w').val()) / multiplier);
                var init_h = Math.round(parseInt($('#crop-h').val()) / multiplier);
                jcrop_api.setSelect([0, 0, init_w, init_h]);
            }
            
            function waitForImage() {
                if ($('#target').length && $('#target')[0].complete) {
                    setSelectJcrop();
                } else {
                    setTimeout(waitForImage, 100);
                }
            }
            
            get_target_details();
        }
        
        function updateImageURL() {
            var imageID = window.currentImageID;
            if (!imageID) return;
            
            var x = $('#crop-x').val() || 0;
            var y = $('#crop-y').val() || 0;
            var w = $('#crop-w').val() || 100;
            var h = $('#crop-h').val() || 100;
            
            var width = $('#custom-width').val();
            if (!width) {
                $('.btn[data-width]').each(function() {
                    if ($(this).hasClass('active')) {
                        width = $(this).data('width');
                    }
                });
            }
            if (!width) width = '800';
            
            var rotation = $('input[name="rotation"]:checked').val() || '0';
            var custom_rotation = $('#custom-rotation').val();
            if (custom_rotation) rotation = custom_rotation;
            
            var format = $('input[name="format"]:checked').val() || 'jpg';
            var quality = $('input[name="quality"]:checked').val() || 'default';
            
            var size = width + ',';
            if ($('#square').is(':checked')) {
                size = width + ',' + width;
            }
            
            var iiif_url = imageID + '/' + x + ',' + y + ',' + w + ',' + h + '/' + size + '/' + rotation + '/' + quality + '.' + format;
            $('#iiif_url_output').val(iiif_url);
        }
        
        // Event handlers
        $(document).on('click', '#load_image_btn', function() {
            var imageURL = $('#iiif_link').val().trim();
            loadImageFromURL(imageURL);
        });
        
        $(document).on('click', '#full_image_btn', function() {
            if (window.currentImageID) {
                $.getJSON(window.currentImageID + '/info.json')
                    .done(function(info) {
                        $('#crop-x').val(0);
                        $('#crop-y').val(0);
                        $('#crop-w').val(info.width);
                        $('#crop-h').val(info.height);
                        
                        var jcrop_api = $('#target').data('Jcrop');
                        if (jcrop_api) {
                            var multiplier = parseFloat($('#multiplier').val());
                            jcrop_api.setSelect([0, 0, info.width / multiplier, info.height / multiplier]);
                        }
                        updateImageURL();
                    });
            }
        });
        
        $(document).on('click', '.btn[data-width]', function() {
            $('.btn[data-width]').removeClass('active');
            $(this).addClass('active');
            $('#custom-width').val('');
            updateImageURL();
        });
        
        $(document).on('input', '#custom-width, #custom-rotation, #crop-x, #crop-y, #crop-w, #crop-h', function() {
            updateImageURL();
        });
        
        $(document).on('change', 'input[name="format"], input[name="rotation"], input[name="quality"], #square', function() {
            updateImageURL();
        });
        
        $(document).on('click', '#generate_image', function() {
            var url = $('#iiif_url_output').val();
            if (url) {
                window.open(url, '_blank');
            }
        });
        
        $(document).on('click', '#generate_iiif_link', function() {
            updateImageURL();
        });
        
        // Check for imageID parameter on load
        var imageID = getParameterByName('imageID');
        if (imageID) {
            $('#iiif_link').val(imageID);
            loadImageFromURL(imageID);
        }
    }
};

// Initialize on document ready
$(document).ready(function() {
    croptool.init();
});
