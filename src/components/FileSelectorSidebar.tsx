import React from 'react';

interface FileSelectorProps {
    savedFiles: Record<string, any>;
    onFileSelect: (fileId: string) => void;
    currentFileId: string | null;
}

const FileSelectorSidebar: React.FC<FileSelectorProps> = ({
                                                              savedFiles,
                                                              onFileSelect,
                                                              currentFileId
                                                          }) => {
    return (
        <div className="p-4 border-r border-gray-200 h-full">
            <h2 className="text-lg font-semibold mb-4">Saved Files</h2>

            {Object.keys(savedFiles).length === 0 ? (
                <p className="text-gray-500 text-sm">No saved files yet</p>
            ) : (
                <div className="space-y-2">
                    {Object.entries(savedFiles).map(([id, file]) => (
                        <div
                            key={id}
                            className={`p-2 rounded cursor-pointer ${
                                currentFileId === id ? 'bg-blue-100' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => onFileSelect(id)}
                        >
                            <div className="font-medium">{file.name}</div>
                            <div className="text-xs text-gray-500">
                                {new Date(file.date).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload New File
                </label>
                <input
                    type="file"
                    className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                    accept=".shp,.zip"
                    onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                            // Call your file upload handler here
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default FileSelectorSidebar;
