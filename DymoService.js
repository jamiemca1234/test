// src/utils/DymoService.js

/**
 * Utility service for Dymo Label Writer integration
 */
class DymoService {
    constructor() {
      this.dymo = window.dymo;
      this.isFrameworkLoaded = false;
      this.printers = [];
    }
  
    /**
     * Initialize Dymo SDK
     */
    async initializeDymo() {
      try {
        // Load Dymo Framework if not already loaded
        if (!this.isFrameworkLoaded) {
          await this.loadDymoFramework();
        }
  
        // Check if Dymo service is running
        if (!this.dymo.label.framework.init) {
          throw new Error("Dymo framework not properly loaded");
        }
  
        // Initialize framework
        this.dymo.label.framework.init();
        this.isFrameworkLoaded = true;
  
        // Get available printers
        const printers = await this.getPrinters();
        this.printers = printers;
        
        return {
          success: true,
          printers: printers
        };
      } catch (error) {
        console.error("Failed to initialize Dymo:", error);
        return {
          success: false,
          error: error.message || "Failed to initialize Dymo printer service"
        };
      }
    }
  
    /**
     * Load Dymo Framework Script
     */
    loadDymoFramework() {
      return new Promise((resolve, reject) => {
        if (window.dymo) {
          resolve();
          return;
        }
  
        const script = document.createElement('script');
        script.src = 'https://labelwriter.com/software/dls/sdk/js/DYMO.Label.Framework.latest.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Dymo Framework'));
        document.head.appendChild(script);
      });
    }
  
    /**
     * Get available Dymo printers
     */
    async getPrinters() {
      try {
        if (!this.isFrameworkLoaded) {
          await this.initializeDymo();
        }
  
        const printersXml = this.dymo.label.framework.getPrinters();
        if (!printersXml) return [];
  
        const printersList = [];
        const printers = this.dymo.label.framework.getPrinters();
        
        for (let i = 0; i < printers.length; i++) {
          const printer = printers[i];
          if (printer.printerType === "LabelWriterPrinter") {
            printersList.push({
              name: printer.name,
              modelName: printer.modelName,
              isLocal: printer.isLocal,
              isConnected: printer.isConnected
            });
          }
        }
  
        return printersList;
      } catch (error) {
        console.error("Error getting printers:", error);
        return [];
      }
    }
  
    /**
     * Create a label for a repair job
     */
    createJobLabel(jobData) {
      const labelXml = `<?xml version="1.0" encoding="utf-8"?>
      <DieCutLabel Version="8.0" Units="mm">
        <PaperOrientation>Landscape</PaperOrientation>
        <Id>Address</Id>
        <PaperName>30256 Shipping</PaperName>
        <DrawCommands>
          <RoundRectangle X="0" Y="0" Width="101" Height="51" Rx="3.2" Ry="3.2" />
        </DrawCommands>
        <ObjectInfo>
          <TextObject>
            <n>JobRef</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName></LinkedObjectName>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
              <Element>
                <String>Job Ref: ${jobData.job_ref}</String>
                <Attributes>
                  <Font Family="Arial" Size="14" Bold="True" Italic="False" Underline="False" Strikeout="False" />
                  <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
                </Attributes>
              </Element>
            </StyledText>
          </TextObject>
          <Bounds X="5" Y="5" Width="92" Height="10" />
        </ObjectInfo>
        <ObjectInfo>
          <TextObject>
            <n>CustomerName</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName></LinkedObjectName>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
              <Element>
                <String>${jobData.customer_name}</String>
                <Attributes>
                  <Font Family="Arial" Size="12" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                  <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
                </Attributes>
              </Element>
            </StyledText>
          </TextObject>
          <Bounds X="5" Y="17" Width="92" Height="10" />
        </ObjectInfo>
        <ObjectInfo>
          <TextObject>
            <n>Contact</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName></LinkedObjectName>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
              <Element>
                <String>${jobData.contact_number}</String>
                <Attributes>
                  <Font Family="Arial" Size="12" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                  <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
                </Attributes>
              </Element>
            </StyledText>
          </TextObject>
          <Bounds X="5" Y="29" Width="92" Height="10" />
        </ObjectInfo>
        <ObjectInfo>
          <TextObject>
            <n>Date</n>
            <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
            <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
            <LinkedObjectName></LinkedObjectName>
            <Rotation>Rotation0</Rotation>
            <IsMirrored>False</IsMirrored>
            <IsVariable>False</IsVariable>
            <HorizontalAlignment>Center</HorizontalAlignment>
            <VerticalAlignment>Middle</VerticalAlignment>
            <TextFitMode>ShrinkToFit</TextFitMode>
            <UseFullFontHeight>True</UseFullFontHeight>
            <Verticalized>False</Verticalized>
            <StyledText>
              <Element>
                <String>${new Date().toLocaleDateString('en-GB')}</String>
                <Attributes>
                  <Font Family="Arial" Size="10" Bold="False" Italic="False" Underline="False" Strikeout="False" />
                  <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
                </Attributes>
              </Element>
            </StyledText>
          </TextObject>
          <Bounds X="5" Y="41" Width="92" Height="7" />
        </ObjectInfo>
      </DieCutLabel>`;
      
      return labelXml;
    }
  
    /**
     * Print a job label to the Dymo printer
     */
    async printJobLabel(jobData, printerName = null) {
      try {
        if (!this.isFrameworkLoaded) {
          await this.initializeDymo();
        }
        
        // Create label
        const labelXml = this.createJobLabel(jobData);
        const label = this.dymo.label.framework.openLabelXml(labelXml);
        
        // Set default printer if not specified
        if (!printerName && this.printers.length > 0) {
          printerName = this.printers[0].name;
        }
        
        // Print label
        label.print(printerName);
        
        return { success: true };
      } catch (error) {
        console.error("Error printing label:", error);
        return { 
          success: false, 
          error: error.message || "Failed to print label" 
        };
      }
    }
  }
  
  // Export as singleton
  const dymoService = new DymoService();
  export default dymoService;