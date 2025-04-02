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
import {Upload, FileUp, AlertCircle, MapPinned, Eye, Plus} from 'lucide-react';
import shp from 'shpjs';
import { Buffer } from 'buffer';
import { Style, Fill, Stroke } from 'ol/style';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import SideDrawer from "./Shared/SideDrawer.tsx";
import { v4 as uuidv4 } from 'uuid';



interface Note {
    id: string;
    title: string;
    description: string;
    timestamp: string;
}

interface FeatureNotes {
    [featureId: string]: Note[];
}

interface SavedFile {
    id: string;
    name: string;
    timestamp: string;
    features: any[];
    notes: FeatureNotes;
}

// Polyfill for Buffer.isBuffer
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
    Buffer.isBuffer = (obj) => obj instanceof Buffer;
}

const ShapeFileView = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<Map | null>(null);
    const vectorLayer = useRef<VectorLayer<VectorSource> | null>(null);
    const [features, setFeatures] = useState<any[]>([]);
    const [selectedFeature, setSelectedFeature] = useState<any>(null);
    const [shapefiles, setShapefiles] = useState<{ [key: string]: ArrayBuffer }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Notes States
    const [hoveredFeature, setHoveredFeature] = useState<Feature | null>(null);
    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [showViewNotesModal, setShowViewNotesModal] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    const [notes, setNotes] = useState<FeatureNotes>({});
    const popupRef = useRef<HTMLDivElement>(null);
    const popupOverlay = useRef<Overlay | null>(null);
    const notesCardRef = useRef<HTMLDivElement>(null);
    const notesCardOverlay = useRef<Overlay | null>(null);
    const [popupPosition, setPopupPosition] = useState<number[] | undefined>();
    const [isMouseOverPopup, setIsMouseOverPopup] = useState(false);
    const [isMouseOverNotesCard, setIsMouseOverNotesCard] = useState(false);

    const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
    const [currentFileId, setCurrentFileId] = useState<string | null>(null);
    const [newNoteTitle, setNewNoteTitle] = useState<string>('');
    const [newNoteText, setNewNoteText] = useState<string>('');




    // Load saved files from localStorage on mount
    useEffect(() => {
        const savedFilesData = localStorage.getItem('savedFiles');
        if (savedFilesData) {
            setSavedFiles(JSON.parse(savedFilesData));
        }
    }, []);


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

            // Create popup overlay for buttons
            popupOverlay.current = new Overlay({
                element: popupRef.current!,
                positioning: 'top-left',
                stopEvent: true,
                autoPan: false
            });
            map.current.addOverlay(popupOverlay.current);

            // Add a manual event listener to the popup element
            popupRef.current!.addEventListener('mouseenter', () => {
                setIsMouseOverPopup(true);
            });

            popupRef.current!.addEventListener('mouseleave', () => {
                setIsMouseOverPopup(false);
            });

            // Create overlay for notes card
            notesCardOverlay.current = new Overlay({
                element: notesCardRef.current!,
                positioning: 'top-left',
                stopEvent: false,
                offset: [0, 50]
            });
            map.current.addOverlay(notesCardOverlay.current);

            // Add event listeners to notes card
            notesCardRef.current!.addEventListener('mouseenter', () => {
                setIsMouseOverNotesCard(true);
            });

            notesCardRef.current!.addEventListener('mouseleave', () => {
                setIsMouseOverNotesCard(false);
            });

            let currentFeature: Feature | null = null;
            let timeoutId: number | null = null;

            // Add hover interaction
            map.current.on('pointermove', (e) => {
                if (e.dragging) return;

                const hit = map.current!.forEachFeatureAtPixel(e.pixel, (feature) => feature);

                if (hit) {
                    // Clear any existing timeout
                    if (timeoutId) {
                        window.clearTimeout(timeoutId);
                        timeoutId = null;
                    }

                    if (hit !== currentFeature) {
                        currentFeature = hit as Feature;
                        setHoveredFeature(currentFeature);

                        // Get feature's center coordinate for stable button position
                        const geometry = currentFeature.getGeometry();
                        if (geometry) {
                            const extent = geometry.getExtent();
                            const center = [
                                (extent[0] + extent[2]) / 2, // Center X
                                (extent[1] + extent[3]) / 2  // Center Y
                            ];
                            setPopupPosition(center);
                            popupOverlay.current!.setPosition(center);
                            notesCardOverlay.current!.setPosition(center);
                        }
                    }
                } else {
                    // Only hide if not over popup or notes card
                    if (currentFeature && !isMouseOverPopup && !isMouseOverNotesCard) {
                        // Set a timeout to hide the overlays
                        if (timeoutId) {
                            window.clearTimeout(timeoutId);
                        }

                        timeoutId = window.setTimeout(() => {
                            // Double-check before hiding
                            if (!isMouseOverPopup && !isMouseOverNotesCard) {
                                currentFeature = null;
                                setHoveredFeature(null);
                                setPopupPosition(undefined);
                                popupOverlay.current!.setPosition(undefined);
                                notesCardOverlay.current!.setPosition(undefined);
                            }
                        }, 300);
                    }
                }
            });

            // Add click handler to close popups when clicking elsewhere
            map.current.on('click', (e) => {
                const hit = map.current!.forEachFeatureAtPixel(e.pixel, (feature) => feature);
                if (!hit && !isMouseOverPopup && !isMouseOverNotesCard) {
                    currentFeature = null;
                    setHoveredFeature(null);
                    setPopupPosition(undefined);
                    popupOverlay.current!.setPosition(undefined);
                    notesCardOverlay.current!.setPosition(undefined);
                }
            });
        }
    }, []);

    // Add effect to update popup behavior when mouse state changes
    useEffect(() => {
        // This effect ensures the popup stays visible when mouse is over it
        if (isMouseOverPopup || isMouseOverNotesCard) {
            // Keep popup visible
            if (popupPosition && popupOverlay.current) {
                popupOverlay.current.setPosition(popupPosition);
            }
            if (popupPosition && notesCardOverlay.current) {
                notesCardOverlay.current.setPosition(popupPosition);
            }
        }
    }, [isMouseOverPopup, isMouseOverNotesCard, popupPosition]);

    const addNote = () => {
        if (!hoveredFeature || !noteTitle.trim() || !noteDescription.trim()) return;

        const featureId = hoveredFeature.ol_uid;
        const newNote: Note = {
            id: Math.random().toString(36).substr(2, 9),
            title: noteTitle,
            description: noteDescription,
            timestamp: new Date().toISOString()
        };


        const updatedNotes = {
            ...notes,
            [featureId]: [...(notes[featureId] || []), newNote]
        };

        setNotes(updatedNotes);
        saveCurrentState(updatedNotes);

        setNoteTitle('');
        setNoteDescription('');
        setShowAddNoteModal(false);
    };

    const handleAddNote = () => {
        if (!hoveredFeature || !newNoteText.trim() || !currentFileId) return;

        const featureId = hoveredFeature.ol_uid;
        const newNote = {
            id: uuidv4(),
            text: newNoteText.trim(),
            timestamp: new Date().toISOString()
        };

        // Update notes state
        const updatedNotes = {
            ...notes,
            [featureId]: [...(notes[featureId] || []), newNote]
        };

        setNotes(updatedNotes);
        saveCurrentState(updatedNotes);

        // Clear the input field
        setNewNoteText('');
    };

    const handleDeleteNote = (featureId: string, noteId: string) => {
        if (!currentFileId) return;

        // Filter out the note to delete
        const updatedFeatureNotes = notes[featureId].filter(note => note.id !== noteId);

        // Update notes state
        const updatedNotes = {
            ...notes,
            [featureId]: updatedFeatureNotes
        };

        setNotes(updatedNotes);
        saveCurrentState(updatedNotes);
    };


    const saveCurrentState = (currentNotes: FeatureNotes = notes) => {
        if (!features.length) return;

        const fileId = currentFileId || Math.random().toString(36).substr(2, 9);
        const newSavedFile: SavedFile = {
            id: fileId,
            name: `Shapefile ${new Date().toLocaleDateString()}`,
            timestamp: new Date().toISOString(),
            features: features,
            notes: currentNotes
        };

        const updatedSavedFiles = currentFileId
            ? savedFiles.map(f => f.id === currentFileId ? newSavedFile : f)
            : [...savedFiles, newSavedFile];

        setSavedFiles(updatedSavedFiles);
        setCurrentFileId(fileId);
        localStorage.setItem('savedFiles', JSON.stringify(updatedSavedFiles));
    };


    const loadSavedFile = (fileId: string) => {
        const savedFile = savedFiles.find(f => f.id === fileId);
        if (!savedFile) return;

        setCurrentFileId(fileId);
        setFeatures(savedFile.features);
        setNotes(savedFile.notes);

        if (vectorLayer.current) {
            vectorLayer.current.getSource()?.clear();
            const format = new GeoJSON();
            const features = format.readFeatures({
                type: 'FeatureCollection',
                features: savedFile.features
            }, {
                featureProjection: 'EPSG:3857'
            });

            vectorLayer.current.getSource()?.addFeatures(features);

            const extent = vectorLayer.current.getSource()?.getExtent();
            if (extent) {
                map.current?.getView().fit(extent, { padding: [50, 50, 50, 50] });
            }
        }
    };


    //  debug feature geometry
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

            // Convert ArrayBuffer to Buffer for shpjs
            const shpBuffer = Buffer.from(files['.shp']);
            const dbfBuffer = Buffer.from(files['.dbf']);

            // Add support for CPG file if available
            let cpgBuffer;
            if (files['.cpg']) {
                cpgBuffer = Buffer.from(files['.cpg']);
            }

            // Parse the shapefile components
            const parsedShp = await shp.parseShp(shpBuffer);
            const parsedDbf = await shp.parseDbf(dbfBuffer, cpgBuffer);

            // Combine the parsed components
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

            // Clear existing features
            if (vectorLayer.current) {
                vectorLayer.current.getSource()?.clear();
            }

            // Add new features
            const format = new GeoJSON();
            const features = format.readFeatures(geojson, {
                featureProjection: 'EPSG:3857'
            });

            if (vectorLayer.current) {
                vectorLayer.current.getSource()?.addFeatures(features);

                // Fit view to features extent
                const extent = vectorLayer.current.getSource()?.getExtent();
                if (extent) {
                    map.current?.getView().fit(extent, { padding: [50, 50, 50, 50] });
                }
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
            setNotes({});
            setCurrentFileId(null);
            saveCurrentState({});
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
            setShapefiles({});
            setNotes({});
            setCurrentFileId(null);
            saveCurrentState({});
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
                        <MapPinned className="w-6 h-6"/>
                        Shapefile Viewer
                    </h1>

                    {/* Saved Files Dropdown */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Saved Files
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={currentFileId || ''}
                                onChange={(e) => loadSavedFile(e.target.value)}
                                className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select a saved file</option>
                                {savedFiles.map(file => (
                                    <option key={file.id} value={file.id}>
                                        {file.name} ({new Date(file.timestamp).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-4 mb-6">
                        <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center gap-2 text-blue-700 mb-2">
                                <AlertCircle className="w-4 h-4"/>
                                <span className="font-medium">Required Files:</span>
                            </div>
                            <p className="text-sm text-blue-600">
                                Upload both .SHP and .DBF files, or a ZIP containing both.
                            </p>
                        </div>

                        <label
                            className="flex flex-col items-center px-4 py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100">
                            <Upload className="w-8 h-8 text-gray-400 mb-2"/>
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
                                    <FileUp className="w-4 h-4"/>
                                    <span className="font-medium">Uploaded Files:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {getUploadedFiles().map(file => (
                                        <span key={file}
                                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
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
                <div className="relative flex-1">
                    <div ref={mapContainer} className="h-full" />

                    {/* Popup for Add/View Notes buttons */}
                    <div
                        ref={popupRef}
                        className={`absolute w-60  rounded-lg z-50 ${
                            popupPosition || isMouseOverPopup ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        } transition-opacity duration-300`}
                        style={{ pointerEvents: 'auto' }}
                        onMouseEnter={() => setIsMouseOverPopup(true)}
                        onMouseLeave={() => setIsMouseOverPopup(false)}
                    >
                        <div className="flex justify-between gap-2">
                            {/*<button*/}
                            {/*    onClick={() => setShowAddNoteModal(true)}*/}
                            {/*    className="flex w-1/2 items-center gap-1  px-3 py-2 bg-blue-500 text-sm text-white rounded hover:bg-blue-600 transition-colors"*/}
                            {/*>*/}
                            {/*    <Plus className="w-4 h-4" />*/}
                            {/*    Add Note*/}
                            {/*</button>*/}
                            <button
                                onClick={() => setShowViewNotesModal(true)}
                                className="flex w-1/2 items-center gap-1  px-3 py-2 bg-blue-500 text-sm text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                <Eye className="w-4 h-4" />
                                View Notes
                            </button>
                        </div>
                    </div>

                    {/* Notes Card */}
                    <div
                        ref={notesCardRef}
                        className={`absolute w-56  bg-white rounded-lg shadow-lg p-4 z-40 ${
                            hoveredFeature && (notes[hoveredFeature.ol_uid]?.length > 0) ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        } transition-opacity duration-300`}
                        style={{ maxHeight: '300px', overflowY: 'auto', pointerEvents: 'auto' }}
                        onMouseEnter={() => setIsMouseOverNotesCard(true)}
                        onMouseLeave={() => setIsMouseOverNotesCard(false)}
                    >
                        {hoveredFeature && notes[hoveredFeature.ol_uid]?.slice(0, 5).map((note) => (
                            <div key={note.id} className="mb-3 last:mb-0">
                                <h4 className="font-semibold text-sm">{note.title}</h4>
                                <p className="text-sm text-gray-600 line-clamp-2">{note.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add Note Modal */}
            <SideDrawer
                isOpen={showAddNoteModal}
                onClose={() => setShowAddNoteModal(false)}
                title="Add Note"
                wide="max-w-lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Title
                        </label>
                        <input
                            type="text"
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter note title"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={noteDescription}
                            onChange={(e) => setNoteDescription(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                            placeholder="Enter note description"
                        />
                    </div>
                    <button
                        onClick={addNote}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        Add Note
                    </button>
                </div>
            </SideDrawer>

            {/* View Notes Modal */}
            <SideDrawer
                isOpen={showViewNotesModal}
                onClose={() => setShowViewNotesModal(false)}
                title="View Notes"
                wide="max-w-lg"
            >
                <div className="space-y-4 mt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Feature Notes</h3>
                    {hoveredFeature && notes[hoveredFeature.ol_uid]?.length > 0 ? (
                        notes[hoveredFeature.ol_uid]?.map((note) => (
                            <div
                                key={note.id}
                                className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500 hover:shadow-lg transition-shadow duration-200 mb-3"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-900 mb-1">{note.title || 'Untitled Note'}</h4>
                                        <p className="text-gray-700 whitespace-pre-wrap">{note.text}</p>
                                        <div className="mt-2 flex items-center text-xs text-gray-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none"
                                                 viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                            </svg>
                                            <span>{new Date(note.timestamp).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const updatedNotes = {
                                                ...notes,
                                                [hoveredFeature.ol_uid]: notes[hoveredFeature.ol_uid].filter(n => n.id !== note.id)
                                            };
                                            setNotes(updatedNotes);
                                            saveCurrentState(updatedNotes);
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition-colors duration-200 ml-2"
                                        aria-label="Delete note"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                                             fill="currentColor">
                                            <path fillRule="evenodd"
                                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                                  clipRule="evenodd"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        hoveredFeature ? (
                            <div
                                className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 border border-dashed border-gray-300">
                                No notes for this feature. Add a note below.
                            </div>
                        ) : (
                            <div
                                className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 border border-dashed border-gray-300">
                                Hover over a feature to see or add notes.
                            </div>
                        )
                    )}

                    {hoveredFeature && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="mb-3">
                                <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-1">
                                    Note Title
                                </label>
                                <input
                                    id="note-title"
                                    type="text"
                                    value={newNoteTitle}
                                    onChange={(e) => setNewNoteTitle(e.target.value)}
                                    placeholder="Enter a title for your note"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="mb-3">
                                <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">
                                    Note Content
                                </label>
                                <textarea
                                    id="note-content"
                                    value={newNoteText}
                                    onChange={(e) => setNewNoteText(e.target.value)}
                                    placeholder="Add details about this feature..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    rows={3}
                                />
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={() => {
                                        if (!newNoteText.trim() || !hoveredFeature) return;

                                        // Create a new note with title
                                        const newNote = {
                                            id: uuidv4(),
                                            title: newNoteTitle.trim() || 'Untitled Note',
                                            text: newNoteText.trim(),
                                            timestamp: new Date().toISOString()
                                        };

                                        // Update notes
                                        const updatedNotes = {
                                            ...notes,
                                            [hoveredFeature.ol_uid]: [...(notes[hoveredFeature.ol_uid] || []), newNote]
                                        };

                                        setNotes(updatedNotes);
                                        saveCurrentState(updatedNotes);

                                        // Clear input fields
                                        setNewNoteTitle('');
                                        setNewNoteText('');
                                    }}
                                    disabled={!newNoteText?.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                >
                                    Add Note
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </SideDrawer>
        </div>
    );
};

export default ShapeFileView;
