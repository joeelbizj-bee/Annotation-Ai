import React, { useState } from 'react';
import { 
  Plus, 
  Download, 
  Search, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle2,
  FileDown,
  Wand2,
  Loader2,
  MousePointer2,
  Target
} from 'lucide-react';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { searchForImages, suggestAnnotations } from './services/geminiService';
import { ProjectImage, BoundingBox, SearchResult, Annotation } from './types';

function App() {
  // State
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('car on a bridge');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [exportFirstName, setExportFirstName] = useState('');
  const [exportLastName, setExportLastName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Constants
  const TARGET_IMAGE_COUNT = 5;

  // Derived
  const selectedImage = images.find(img => img.id === selectedImageId);
  const selectedAnnotation = selectedImage?.annotations.find(a => a.id === selectedAnnotationId);
  const imagesCount = images.length;
  const progress = Math.min(100, (imagesCount / TARGET_IMAGE_COUNT) * 100);
  const exportFilename = `CSV.${exportFirstName || 'FirstName'}.${exportLastName || 'LastName'}.csv`;

  // Handlers
  const handleAddImage = (url: string, name: string = 'Untitled') => {
    const newImage: ProjectImage = {
      id: crypto.randomUUID(),
      url,
      name,
      annotations: []
    };
    setImages(prev => [...prev, newImage]);
    setSelectedImageId(newImage.id);
    setSearchResults([]); // Clear search results after pick
    setImageUrlInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newImage: ProjectImage = {
        id: crypto.randomUUID(),
        url,
        name: file.name,
        annotations: [],
        file // Store file for potential analysis
      };
      setImages(prev => [...prev, newImage]);
      setSelectedImageId(newImage.id);
    }
  };

  const handleGeminiSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchForImages(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddAnnotation = (box: BoundingBox) => {
    if (!selectedImageId) return;
    
    setImages(prev => prev.map(img => {
      if (img.id === selectedImageId) {
        return {
          ...img,
          annotations: [...img.annotations, {
            ...box,
            metadata: { name: '', type: 'Sedan', quality: 'Medium' }
          }]
        };
      }
      return img;
    }));
    
    // Auto-select the new annotation
    setSelectedAnnotationId(box.id);
  };

  const handleUpdateMetadata = (key: keyof Annotation['metadata'], value: string) => {
    if (!selectedImageId || !selectedAnnotationId) return;

    setImages(prev => prev.map(img => {
      if (img.id === selectedImageId) {
        return {
          ...img,
          annotations: img.annotations.map(ann => {
            if (ann.id === selectedAnnotationId) {
              return { ...ann, metadata: { ...ann.metadata, [key]: value } };
            }
            return ann;
          })
        };
      }
      return img;
    }));
  };

  const handleDeleteAnnotation = (id: string) => {
    if (!selectedImageId) return;
    setImages(prev => prev.map(img => {
      if (img.id === selectedImageId) {
        return { ...img, annotations: img.annotations.filter(a => a.id !== id) };
      }
      return img;
    }));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  };

  const handleAIAnalyze = async () => {
    if (!selectedImage || !selectedAnnotation) return;
    
    setIsAnalyzing(true);
    try {
        let base64 = "";
        let mimeType = "image/jpeg";

        if (selectedImage.url.startsWith('blob:')) {
            const response = await fetch(selectedImage.url);
            const blob = await response.blob();
            mimeType = blob.type;
            base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
            // remove prefix
            base64 = base64.split(',')[1];
        } else {
             try {
                const response = await fetch(selectedImage.url);
                const blob = await response.blob();
                mimeType = blob.type;
                base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                base64 = base64.split(',')[1];
             } catch (e) {
                 alert("Cannot analyze external image due to browser security (CORS). Please download and upload the image to use AI features.");
                 setIsAnalyzing(false);
                 return;
             }
        }

        const jsonStr = await suggestAnnotations(base64, mimeType);
        try {
            const cleaned = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleaned);
            if(data.name) handleUpdateMetadata('name', data.name);
            if(data.type) handleUpdateMetadata('type', data.type);
            if(data.quality) handleUpdateMetadata('quality', data.quality);
        } catch (e) {
            console.error("Failed to parse AI response", e);
        }

    } catch (e) {
        console.error(e);
        alert("AI Analysis failed.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleExportCSV = () => {
    if (!exportFirstName || !exportLastName) {
      alert("Please enter First and Last name for the file.");
      return;
    }

    // CSV Header matching requirements: Name, Type, Image Quality
    const simpleHeader = "Filename,Car Name,Type,Quality,X(%),Y(%),Width(%),Height(%)\n";
    const simpleRows = images.flatMap(img => 
      img.annotations.map(ann => 
        `"${img.name}","${ann.metadata.name.replace(/"/g, '""')}","${ann.metadata.type}","${ann.metadata.quality}",${ann.x.toFixed(2)},${ann.y.toFixed(2)},${ann.width.toFixed(2)},${ann.height.toFixed(2)}`
      )
    ).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + simpleHeader + simpleRows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", exportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExporting(false);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <CheckCircle2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">AutoTag</h1>
            <p className="text-xs text-slate-400">Assignment: Car on a Bridge</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full bg-slate-900 border border-slate-800 px-4 py-1.5 text-xs text-slate-400">
             <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-indigo-400"/>
                <span>Progress:</span>
                <span className={imagesCount >= TARGET_IMAGE_COUNT ? "text-emerald-400 font-bold" : "text-slate-200 font-semibold"}>
                  {imagesCount} / {TARGET_IMAGE_COUNT} Images
                </span>
             </div>
             <span className="h-3 w-px bg-slate-700"></span>
             <span>Annotations:</span>
             <span className="font-bold text-white">{images.reduce((acc, img) => acc + img.annotations.length, 0)}</span>
          </div>
          <button
            onClick={() => setIsExporting(true)}
            className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Image Manager */}
        <aside className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-925 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            {/* Progress Bar */}
            <div className="mb-6 rounded-lg bg-slate-800/50 p-3 border border-slate-700/50">
              <div className="flex justify-between text-[10px] uppercase tracking-wider font-semibold mb-2">
                 <span className="text-slate-400">Assignment Progress</span>
                 <span className={progress >= 100 ? "text-emerald-400" : "text-indigo-400"}>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                   className={`h-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                   style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                {progress < 100 
                  ? `Collect ${TARGET_IMAGE_COUNT - imagesCount} more images to complete the set.`
                  : "Collection complete! Ensure all images are annotated."}
              </p>
            </div>

            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Add Images</h2>
            
            {/* Search */}
            <div className="space-y-3">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 pl-3 pr-10 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Find images..."
                />
                <button 
                  onClick={handleGeminiSearch}
                  disabled={isSearching}
                  className="absolute right-1 top-1 rounded bg-slate-700 p-1.5 text-slate-300 hover:text-white disabled:opacity-50"
                  title="Search with Gemini"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4" />}
                </button>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <input 
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Paste Image URL..."
                    className="flex-1 rounded-md border border-slate-700 bg-slate-800 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none placeholder-slate-500"
                />
                <button
                    onClick={() => handleAddImage(imageUrlInput, `Image ${images.length + 1}`)}
                    disabled={!imageUrlInput}
                    className="rounded-md bg-slate-700 px-3 py-2 text-white hover:bg-slate-600 disabled:opacity-50"
                    title="Add URL"
                >
                    <Plus className="h-4 w-4"/>
                </button>
              </div>

              {/* Upload */}
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-700 bg-slate-800/50 py-3 transition hover:bg-slate-800 hover:border-slate-600 group">
                <ImageIcon className="h-4 w-4 text-slate-400 group-hover:text-slate-300" />
                <span className="text-sm text-slate-400 group-hover:text-slate-300">Upload Local File</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 p-2 scrollbar-thin scrollbar-thumb-slate-700">
                <p className="mb-2 text-xs font-medium text-slate-500">Gemini Suggestions:</p>
                <ul className="space-y-2">
                  {searchResults.map((res, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 rounded bg-slate-800 p-2 text-xs group hover:bg-slate-750">
                      <div className="flex-1 overflow-hidden">
                        <p className="truncate font-medium text-indigo-400" title={res.title}>{res.title}</p>
                        <a href={res.url} target="_blank" rel="noreferrer" className="truncate text-[10px] text-slate-500 hover:underline">{res.url}</a>
                      </div>
                      <button 
                        onClick={() => handleAddImage(res.url, res.title)}
                        className="flex-shrink-0 rounded bg-indigo-600 p-1 text-white hover:bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Use this image"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4">
             <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex justify-between">
               <span>Project Files</span>
               <span className="text-slate-600">{images.length}</span>
             </h2>
             <div className="space-y-2">
               {images.map(img => (
                 <div 
                   key={img.id}
                   onClick={() => setSelectedImageId(img.id)}
                   className={`group flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-all ${
                     selectedImageId === img.id 
                       ? 'border-indigo-500 bg-indigo-500/10' 
                       : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
                   }`}
                 >
                   <div className="h-10 w-10 overflow-hidden rounded bg-slate-900 flex-shrink-0 border border-slate-700">
                     <img src={img.url} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100" />
                   </div>
                   <div className="flex-1 overflow-hidden">
                     <p className="truncate text-sm font-medium text-slate-200">{img.name}</p>
                     <p className="text-[10px] text-slate-500 flex items-center gap-1">
                       {img.annotations.length > 0 ? (
                         <span className="text-emerald-500">{img.annotations.length} annotated</span>
                       ) : (
                         <span className="text-amber-500">Needs annotation</span>
                       )}
                     </p>
                   </div>
                 </div>
               ))}
               {images.length === 0 && (
                 <div className="text-center py-8 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-lg">
                   <p className="font-medium text-slate-500 mb-2">Instructions</p>
                   <ol className="text-xs text-left inline-block space-y-1 list-decimal pl-4">
                      <li>Search for 'car on a bridge'</li>
                      <li>Collect 5 image URLs</li>
                      <li>Annotate images (Name, Type, Quality)</li>
                      <li>Export CSV</li>
                   </ol>
                 </div>
               )}
             </div>
          </div>
        </aside>

        {/* Center: Workspace */}
        <section className="flex-1 flex flex-col bg-slate-950 relative">
           <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
              <div className="relative w-full h-full max-w-5xl max-h-[80vh]">
                <AnnotationCanvas 
                  imageUrl={selectedImage?.url || ''}
                  annotations={selectedImage?.annotations || []}
                  onAddAnnotation={handleAddAnnotation}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  selectedId={selectedAnnotationId}
                />
              </div>
           </div>
           
           {/* Bottom Bar: Instructions */}
           <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-6 gap-4 text-xs text-slate-400">
             <AlertCircle className="h-4 w-4 text-indigo-400" />
             <p>To annotate: Click and drag on the image to draw a box around a car. Then complete the details on the right.</p>
           </div>
        </section>

        {/* Right Sidebar: Metadata */}
        <aside className="w-80 flex-shrink-0 border-l border-slate-800 bg-slate-925 flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Annotation Details</h2>
            {selectedAnnotationId && (
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">Selected</span>
            )}
          </div>
          
          {selectedAnnotation ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="space-y-2">
                 <label className="text-xs font-medium text-slate-400">Name (e.g. Red Ford Mustang)</label>
                 <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={selectedAnnotation.metadata.name}
                        onChange={(e) => handleUpdateMetadata('name', e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none placeholder-slate-600"
                        placeholder="Enter name..."
                        autoFocus
                    />
                    <button 
                        onClick={handleAIAnalyze}
                        disabled={isAnalyzing}
                        title="Auto-fill with AI"
                        className="p-2 bg-indigo-600 rounded text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
                    </button>
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-xs font-medium text-slate-400">Type</label>
                 <select 
                   value={selectedAnnotation.metadata.type}
                   onChange={(e) => handleUpdateMetadata('type', e.target.value)}
                   className="w-full rounded-md border border-slate-700 bg-slate-800 py-2 px-3 text-sm text-white focus:border-indigo-500 focus:outline-none"
                 >
                   <option>Sedan</option>
                   <option>SUV</option>
                   <option>Truck</option>
                   <option>Coupe</option>
                   <option>Convertible</option>
                   <option>Van</option>
                   <option>Hatchback</option>
                   <option>Wagon</option>
                   <option>Sports Car</option>
                   <option>Pickup</option>
                   <option>Bus</option>
                   <option>Motorcycle</option>
                   <option>Other</option>
                 </select>
               </div>

               <div className="space-y-2">
                 <label className="text-xs font-medium text-slate-400">Image Quality</label>
                 <div className="grid grid-cols-3 gap-2">
                   {['Low', 'Medium', 'High'].map((q) => (
                     <button
                       key={q}
                       onClick={() => handleUpdateMetadata('quality', q as any)}
                       className={`rounded py-2 text-xs font-medium transition-colors border ${
                         selectedAnnotation.metadata.quality === q
                           ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                           : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                       }`}
                     >
                       {q}
                     </button>
                   ))}
                 </div>
               </div>

               <div className="pt-6 border-t border-slate-800">
                  <h3 className="text-xs font-medium text-slate-500 mb-3">Region Attributes</h3>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-xs text-slate-400 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                    <div>
                        <span className="block text-slate-500 mb-0.5">X Position</span>
                        <span className="font-mono text-slate-300">{selectedAnnotation.x.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 mb-0.5">Y Position</span>
                        <span className="font-mono text-slate-300">{selectedAnnotation.y.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 mb-0.5">Width</span>
                        <span className="font-mono text-slate-300">{selectedAnnotation.width.toFixed(1)}%</span>
                    </div>
                    <div>
                        <span className="block text-slate-500 mb-0.5">Height</span>
                        <span className="font-mono text-slate-300">{selectedAnnotation.height.toFixed(1)}%</span>
                    </div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-600 text-center px-4">
              <MousePointer2 className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm font-medium text-slate-500 mb-1">No Selection</p>
              <p className="text-xs text-slate-600">Select an annotation region on the canvas to edit its details.</p>
            </div>
          )}
        </aside>
      </main>

      {/* Export Modal */}
      {isExporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileDown className="w-5 h-5 text-emerald-500"/> Export Project
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Download your annotations as a CSV file for the assignment.
            </p>

            {imagesCount < TARGET_IMAGE_COUNT && (
               <div className="mb-6 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-200">
                     <p className="font-bold mb-1">Incomplete Collection</p>
                     <p>You have collected {imagesCount} of {TARGET_IMAGE_COUNT} required images. You can still export, but the assignment may be incomplete.</p>
                  </div>
               </div>
            )}
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                <input
                  type="text"
                  value={exportFirstName}
                  onChange={e => setExportFirstName(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                  placeholder="e.g. John"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                <input
                  type="text"
                  value={exportLastName}
                  onChange={e => setExportLastName(e.target.value)}
                  className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                  placeholder="e.g. Doe"
                />
              </div>

              <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <span className="text-xs text-slate-500 block mb-1">Filename Preview:</span>
                  <code className="text-xs text-emerald-400 break-all">{exportFilename}</code>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsExporting(false)}
                className="px-4 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleExportCSV}
                className="px-4 py-2 rounded bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;