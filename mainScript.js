require([
        "esri/config",
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/widgets/Editor",
        "esri/widgets/Expand",
        "esri/widgets/Search",
        "esri/core/reactiveUtils",
        "esri/popup/content/AttachmentsContent",
        "esri/popup/content/TextContent",
        "esri/widgets/Legend",
        "esri/smartMapping/labels/clusters",
        "esri/smartMapping/popup/clusters",
        "esri/WebMap"
      ], function(esriConfig, Map, MapView, FeatureLayer, Editor, Expand, Search, reactiveUtils, AttachmentsContent, TextContent, Legend, clusterLabelCreator, clusterPopupCreator, WebMap) {
      
        // Function to create rating content
        function ratingContent(feature) {
            const attachmentsElement = new AttachmentsContent({
                displayType: "list"
            });
      
            const textElement = new TextContent();
      
            const rating = feature.graphic.attributes.Rating;
            let color;
            if (rating >= 4) {
                color = "green";
            } else if (rating >= 2) {
                color = "purple";
            } else {
                color = "red";
            }
            const review = feature.graphic.attributes.Reviews;
            const reviewer = feature.graphic.attributes.Creator;
            textElement.text = `
                <div >
                    <p style="margin: 0;">
                      The rating for this feature is 
                      <b><span style="color:${color}; font-size: 1.4em;">${rating}</span></b>/5.
                    </p>
                    <p style="margin: 0;">
                      <b>Reviewers:</b> ${reviewer}
                    </p>
                    <p style="margin: 0;">
                      <b>Reviews:</b> ${review}
                    </p>
                  </div>
            `;
      
            return [textElement, attachmentsElement];
        }
      
        // Reference a feature layer to edit
        const myPointsFeatureLayer = new FeatureLayer({
            url: "https://services8.arcgis.com/LLNIdHmmdjO2qQ5q/arcgis/rest/services/AddTableRelation/FeatureServer",
            outFields: ["*"], // Ensure all fields are available for editing
            popupTemplate: {
                title: "Location: {place_name}",
                content: ratingContent,
                fieldInfos: [
                    { fieldName: "rating", label: "Rating" }
                ],
            }
        });
      
        myPointsFeatureLayer.renderer = {
            type: "unique-value",
            field: "category",
            defaultSymbol: { type: "simple-fill" },
            uniqueValueInfos: [{
                value: "Shopping",
                symbol: {
                    type: "simple-fill",
                    color: "blue"
                }
            }, {
                value: "Hotels",
                symbol: {
                    type: "simple-fill",
                    color: "green"
                }
            }, {
                value: "Attractions",
                symbol: {
                    type: "simple-fill",
                    color: "red"
                }
            }, {
                value: "Recreation",
                symbol: {
                    type: "simple-fill",
                    color: "yellow"
                }
            }],
            visualVariables: [{
                type: "opacity",
                field: "POPULATION",
                normalizationField: "SQ_KM",
                stops: [{ value: 100, opacity: 0.15 },
                        { value: 1000, opacity: 0.90 }]
            }]
        };
      
        myPointsFeatureLayer
            .when()
            .then(generateClusterConfig)
            .then((featureReduction) => {
                myPointsFeatureLayer.featureReduction = featureReduction;
            })
            .catch((error) => {
                console.error(error);
            });
      
        esriConfig.apiKey = "AAPKfc2bb44eed604a8fb65dfb72c87516b3YdztxXfTJmkRU-XaiQRV8hKNAwckTew2BfIFlC5mXBd-biav5bHtihYv178cmpyr";
      
        const webmap = new WebMap({
            portalItem: {
                id: "7caa937b7f954575bb046c5ec5cc2a0c"
            }
        });
      
        const view = new MapView({
            container: "viewDiv",
            map: webmap,
            center: [-117.18267, 34.0589],
            zoom: 13,
            minZoom: 13,
            maxZoom: 13,
            popup: {
                dockEnabled: false,
                dockOptions: {
                    breakpoint: false,
                }
            },
        });
      
        view.ui.add(
            new Expand({
                content: new Legend({ view }),
                view
            }),
            "top-left"
        );
      
        const searchWidget = new Search({
            view: view
        });
      
        const searchExpand = new Expand({
            view: view,
            content: searchWidget,
            expandIconClass: "esri-icon-search",
            expandTooltip: "Search"
        });
      
        view.ui.add(searchExpand, {
            position: "top-right"
        });
      
        const addFeatureEditor = new Editor({
            view: view,
            icon: "plus"
        });
      
        const addFeatureExpand = new Expand({
            view: view,
            content: addFeatureEditor,
            expandTooltip: "Add Feature"
        });
      
        view.ui.add([addFeatureExpand, searchExpand], {
            position: "top-right",
            index: 0
        });
      
        const editor = new Editor({
            view: view,
            layerInfos: [{
                layer: myPointsFeatureLayer,
                formTemplate: {
                    elements: [
                        { type: "field", fieldName: "place_name", label: "Place Name" },
                        { type: "field", fieldName: "rating", label: "Rating" }
                    ]
                }
            }]
        });
      
        function editThis() {
            if (!editor.activeWorkflow) {
                view.popup.visible = false;
                editor.startUpdateWorkflowAtFeatureEdit(view.popup.selectedFeature);
                view.ui.add(editor, "top-right");
            }
      
            reactiveUtils.when(
                () => editor.viewModel.state === "ready",
                () => {
                    view.ui.remove(editor);
                    view.openPopup({
                        fetchFeatures: true,
                        shouldFocus: true
                    });
                }
            );
        }
      
        reactiveUtils.on(
            () => view.popup,
            "trigger-action",
            (event) => {
                if (event.action.id === "edit-this") {
                    editThis();
                }
            }
        );
      
        reactiveUtils.watch(
            () => view.popup?.visible,
            (event) => {
                if (editor.viewModel.state === "editing-existing-feature") {
                    view.closePopup();
                } else {
                    features = view.popup.features;
                }
            }
        );
      
        myPointsFeatureLayer.on("apply-edits", () => {
            view.ui.remove(editor);
            features.forEach((feature) => {
                feature.popupTemplate = myPointsFeatureLayer.popupTemplate;
            });
            if (features) {
                view.openPopup({
                    features: features
                });
            }
            editor.viewModel.cancelWorkflow();
        });
      
        async function generateClusterConfig(layer) {
            const popupTemplate = await clusterPopupCreator
                .getTemplates({ layer })
                .then((popupTemplateResponse) => popupTemplateResponse.primaryTemplate.value);
      
            const { labelingInfo, clusterMinSize } = await clusterLabelCreator
                .getLabelSchemes({
                    layer,
                    view
                })
                .then((labelSchemes) => labelSchemes.primaryScheme);
      
            return {
                type: "cluster",
                popupTemplate,
                labelingInfo,
                clusterMinSize
            };
        }
      
        // Create a div for filtering by Years_Worked
        const filterDiv = document.createElement("div");
        filterDiv.id = "years-worked-filter";
        filterDiv.className = "esri-widget";
        filterDiv.innerHTML = `
            <div class="filter-item" data-years="1">1 Year</div>
            <div class="filter-item" data-years="2">2 Years</div>
            <div class="filter-item" data-years="3">3 Years</div>
            <div class="filter-item" data-years="4">4 Years</div>
            <div class="filter-item" data-years="5">5 Years</div>
            <div class="filter-item" data-years="all">All</div>
        `;
        filterDiv.style.padding = "10px";
        filterDiv.style.cursor = "pointer"; // Ensure the pointer cursor shows
      
        // Add the Filter div to an Expand widget
        const filterExpand = new Expand({
            view: view,
            content: filterDiv,
            expandIconClass: "esri-icon-filter",
            expandTooltip: "Filter Features"
        });
      
        view.ui.add(filterExpand, {
            position: "top-right"
        });
      
        // Handle filter change
        filterDiv.addEventListener("click", (event) => {
            const selectedYears = event.target.getAttribute("data-years");
            if (selectedYears) {
                if (selectedYears === "all") {
                    myPointsFeatureLayer.definitionExpression = "";
                } else {
                    myPointsFeatureLayer.definitionExpression = `Years_Worked = ${selectedYears}`;
                }
            }
        });
      
        // Clear the filter when the Expand widget is collapsed
        reactiveUtils.when(
            () => !filterExpand.expanded,
            () => {
                myPointsFeatureLayer.definitionExpression = "";
            }
        );
      });
      