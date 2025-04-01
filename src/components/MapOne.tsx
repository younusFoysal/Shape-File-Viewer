import React, { useRef, useState, useEffect } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import { fromLonLat } from 'ol/proj';
import {Upload, FileUp, AlertCircle, MapPinned} from 'lucide-react';
import shp from 'shpjs';
import { Buffer } from 'buffer';
import { Style, Fill, Stroke } from 'ol/style';


// Polyfill for Buffer.isBuffer
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
    Buffer.isBuffer = (obj) => obj instanceof Buffer;
}


const MapOne = () => {

    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<Map | null>(null);
    const vectorLayer = useRef<VectorLayer<VectorSource> | null>(null);
    const [features, setFeatures] = useState<any[]>([]);
    const [selectedFeature, setSelectedFeature] = useState<any>(null);
    const [shapefiles, setShapefiles] = useState<{ [key: string]: ArrayBuffer }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!map.current && mapContainer.current) {
            const vectorSource = new VectorSource();
            vectorLayer.current = new VectorLayer({
                source: vectorSource,
                style: new Style({
                    fill: new Fill({
                        color: 'rgba(0, 136, 136, 0.3)'
                    }),
                    stroke: new Stroke({
                        color: '#088',
                        width: 1.5
                    })
                })
            });

            map.current = new Map({
                target: mapContainer.current,
                layers: [
                    new TileLayer({
                        source: new OSM()
                    }),
                    vectorLayer.current
                ],
                view: new View({
                    center: fromLonLat([-74.5, 40]),
                    zoom: 9
                })
            });
        }
    }, []);

    // Add this function to debug feature geometry
    const debugFeatureGeometry = (geojson: any) => {
        console.log('GeoJSON type:', geojson.type);
        console.log('Features count:', geojson.features?.length || 0);

        if (geojson.features && geojson.features.length > 0) {
            const firstFeature = geojson.features[0];
            console.log('First feature type:', firstFeature.type);
            console.log('First feature geometry type:', firstFeature.geometry?.type);
            console.log('First feature coordinates:', firstFeature.geometry?.coordinates);
        }
    };


    const processShapefiles = async (files = shapefiles) => {
        try {
            setLoading(true);
            setError(null);

            const missingFiles = [];
            if (!files['.shp']) missingFiles.push('.shp');
            if (!files['.dbf']) missingFiles.push('.dbf');

            if (missingFiles.length > 0) {
                throw new Error(`Required files missing: ${missingFiles.join(', ')}`);
            }

            // Create proper Buffer instances
            const shpBuffer = Buffer.from(files['.shp']);
            const dbfBuffer = Buffer.from(files['.dbf']);


            // Add support for CPG file if available
            let cpgBuffer;
            if (files['.cpg']) {
                cpgBuffer = Buffer.from(files['.cpg']);
            }

            // Use the Buffer instances with shpjs
            const parsedShp = await shp.parseShp(shpBuffer);
            const parsedDbf = await shp.parseDbf(dbfBuffer, cpgBuffer);
            const geojson = await shp.combine([parsedShp, parsedDbf]);


            // Convert Polygons to MultiPolygons if needed
            if (geojson && geojson.features) {
                geojson.features = geojson.features.map(feature => {
                    if (feature.geometry.type === 'Polygon') {
                        return {
                            ...feature,
                            geometry: {
                                type: 'MultiPolygon',
                                coordinates: [feature.geometry.coordinates]
                            }
                        };
                    }
                    return feature;
                });
            }

            // Debug the parsed GeoJSON
            console.log('Parsed GeoJSON:', geojson);

            if (!geojson || !geojson.features || !geojson.features.length) {
                throw new Error('No valid features found in the shapefile');
            }

            if (vectorLayer.current) {
                const format = new GeoJSON();
                const features = format.readFeatures(geojson, {
                    dataProjection: 'EPSG:4326',
                    featureProjection: 'EPSG:3857'
                });

                const source = vectorLayer.current.getSource();
                source?.clear();
                source?.addFeatures(features);

                // Get the extent after features are added
                const extent = source?.getExtent();

                // Validate extent before fitting
                if (extent && !isEmptyExtent(extent) && map.current) {
                    const view = map.current.getView();
                    view.fit(extent, {
                        padding: [50, 50, 50, 50],
                        maxZoom: 16,
                        duration: 1000
                    });
                }
            }

            setFeatures(geojson.features);
            setSelectedFeature(null);
        } catch (error) {
            console.error('Error processing shapefiles:', error);
            setError(error instanceof Error ? error.message : 'Error processing shapefiles');
            setFeatures([]);
            setSelectedFeature(null);
        } finally {
            setLoading(false);
        }
    };


    // Helper Function to check if an extent is empty
    const isEmptyExtent = (extent: number[]): boolean => {
        return extent.some(value => !isFinite(value)) ||
            (extent[0] >= extent[2] || extent[1] >= extent[3]);
    };

    const handleZipUpload = async (file: File) => {
        try {
            setLoading(true);
            setError(null);

            const arrayBuffer = await file.arrayBuffer();

            // Create a proper Buffer instance
            const buffer = Buffer.from(arrayBuffer);
            const geojson = await shp(buffer);

            if (!geojson || !geojson.features || !geojson.features.length) {
                throw new Error('No valid features found in the ZIP file');
            }

            // Debug the GeoJSON structure
            debugFeatureGeometry(geojson);

            // Clear existing features
            if (vectorLayer.current) {
                vectorLayer.current.getSource()?.clear();
            }

            // Add new features
            const format = new GeoJSON();
            const features = format.readFeatures(geojson, {
                featureProjection: 'EPSG:3857'
            });

            console.log('Parsed OpenLayers features from ZIP:', features.length);

            if (vectorLayer.current && features.length > 0) {
                vectorLayer.current.getSource()?.addFeatures(features);

                // Fit view to features extent
                const extent = vectorLayer.current.getSource()?.getExtent();
                console.log('Feature extent from ZIP:', extent);

                // Check if extent is valid and not empty before fitting
                if (extent && !isEmptyExtent(extent) && map.current) {
                    map.current.getView().fit(extent, { padding: [50, 50, 50, 50] });
                } else {
                    console.warn('Invalid extent from ZIP, cannot fit view');
                    // Try to center on the first feature as a fallback
                    if (features.length > 0 && map.current) {
                        const geometry = features[0].getGeometry();
                        if (geometry) {
                            const center = geometry.getExtent();
                            map.current.getView().setCenter([
                                (center[0] + center[2]) / 2,
                                (center[1] + center[3]) / 2
                            ]);
                            map.current.getView().setZoom(12);
                        }
                    }
                }
            }

            setFeatures(geojson.features);
            setSelectedFeature(null);
            setShapefiles({}); // Clear individual files state
        } catch (error) {
            console.error('Error loading ZIP file:', error);
            setError(error instanceof Error ? error.message : 'Error loading ZIP file');
            setFeatures([]);
            setSelectedFeature(null);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files?.length) return;

        try {
            setError(null);

            // Handle ZIP file
            if (files[0].name.endsWith('.zip')) {
                await handleZipUpload(files[0]);
                return;
            }

            // Handle individual files
            const newShapefiles = { ...shapefiles };
            let hasNewFiles = false;

            for (const file of files) {
                const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

                if (['.shp', '.shx', '.dbf', '.prj', '.cpg'].includes(extension)) {
                    newShapefiles[extension] = await file.arrayBuffer();
                    hasNewFiles = true;
                    console.log(`Added file with extension: ${extension}`);
                }
            }

            if (hasNewFiles) {
                // Update the state
                setShapefiles(newShapefiles);

                // Log the current state of shapefiles for debugging
                console.log('Current shapefiles state:', Object.keys(newShapefiles));

                if (newShapefiles['.shp'] && newShapefiles['.dbf']) {
                    // Pass the newShapefiles directly to processShapefiles
                    await processShapefiles(newShapefiles);
                } else {
                    const missing = [];
                    if (!newShapefiles['.shp']) missing.push('.shp');
                    if (!newShapefiles['.dbf']) missing.push('.dbf');
                    setError(`Please upload the required files: ${missing.join(', ')}`);
                }
            }
        } catch (error) {
            console.error('Error handling file upload:', error);
            setError(error instanceof Error ? error.message : 'Error handling file upload');
        }
    };

    const getUploadedFiles = () => {
        return Object.keys(shapefiles).map(ext => ext.substring(1).toUpperCase());
    };

    const getMissingRequiredFiles = () => {
        const missing = [];
        if (!shapefiles['.shp']) missing.push('SHP');
        if (!shapefiles['.dbf']) missing.push('DBF');
        return missing;
    };

    const highlightFeature = (feature: any) => {
        setSelectedFeature(feature);

        if (!feature || !vectorLayer.current || !map.current) return;

        const source = vectorLayer.current.getSource();
        if (!source) return;

        const olFeatures = source.getFeatures();
        for (const olFeature of olFeatures) {
            const props = olFeature.getProperties();
            const match = Object.entries(feature.properties).every(
                ([key, value]) => props[key] === value
            );

            if (match) {
                const geometry = olFeature.getGeometry();
                if (geometry) {
                    const extent = geometry.getExtent();
                    if (!isEmptyExtent(extent)) {
                        map.current.getView().fit(extent, {
                            padding: [100, 100, 100, 100],
                            duration: 500,
                            maxZoom: 16
                        });
                    }
                }
                break;
            }
        }
    };


    return (
        <div className="min-h-screen bg-gray-100">
            <div className="flex h-screen">
                {/* Sidebar */}
                <div className="w-80 bg-white shadow-lg p-4 flex flex-col">
                    <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <MapPinned className="w-6 h-6" />
                        Shapefile Viewer
                    </h1>

                    {/* File Upload */}
                    <div className="space-y-4 mb-6">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 text-blue-700 mb-2">
                                <AlertCircle className="w-4 h-4" />
                                <span className="font-medium">Required Files:</span>
                            </div>
                            <p className="text-sm text-blue-600">
                                Upload both .SHP and .DBF files, or a ZIP containing both.
                            </p>
                        </div>

                        <label className="flex flex-col items-center px-4 py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-500 text-center">
                                Upload Shapefile (.zip)<br/>
                                or individual files (.shp, .shx, .dbf, .prj)
                            </span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".zip,.shp,.shx,.dbf,.prj"
                                multiple
                                onChange={handleFileUpload}
                            />
                        </label>

                        {/* Loading State */}
                        {loading && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <p className="text-blue-700">Processing files...</p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && (
                            <div className="p-3 bg-red-50 rounded-lg">
                                <p className="text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Show uploaded files */}
                        {getUploadedFiles().length > 0 && (
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-2 text-blue-700 mb-2">
                                    <FileUp className="w-4 h-4" />
                                    <span className="font-medium">Uploaded Files:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {getUploadedFiles().map(file => (
                                        <span key={file} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                            {file}
                                        </span>
                                    ))}
                                </div>
                                {getMissingRequiredFiles().length > 0 && (
                                    <div className="mt-2 text-sm text-blue-700">
                                        Still needed: {getMissingRequiredFiles().join(', ')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Feature List */}
                    <div className="flex-1 overflow-auto">
                        <h2 className="text-lg font-semibold mb-2">Features</h2>
                        <div className="space-y-2">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded cursor-pointer ${
                                        selectedFeature === feature
                                            ? 'bg-blue-100 border-blue-300'
                                            : 'bg-gray-50 hover:bg-gray-100'
                                    }`}
                                    onClick={() => highlightFeature(feature)}
                                >
                                    <h3 className="font-medium">Feature {index + 1}</h3>
                                    {feature.properties && (
                                        <div className="text-sm text-gray-600">
                                            {Object.entries(feature.properties).map(([key, value]) => (
                                                <div key={key} className="truncate">
                                                    <span className="font-medium">{key}:</span> {String(value)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Map Container */}
                <div ref={mapContainer} className="flex-1" />
            </div>
        </div>
    );
};

export default MapOne;
