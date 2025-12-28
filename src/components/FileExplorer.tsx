import React, { useState, useEffect } from 'react';
import { GitHubNode } from '../types';
import { fetchRepoContents } from '../services/githubService';
import { Folder, FileCode, ChevronRight, ChevronDown, Loader2, ArrowLeft } from 'lucide-react';

interface FileExplorerProps {
  owner: string;
  repo: string;
  onSelectFile: (node: GitHubNode) => void;
  selectedFile: GitHubNode | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ owner, repo, onSelectFile, selectedFile }) => {
  const [currentPath, setCurrentPath] = useState('');
  const [nodes, setNodes] = useState<GitHubNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const content = await fetchRepoContents(owner, repo, path);
      setNodes(content);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPath('');
  }, [owner, repo]);

  const handleNavigateUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    loadPath(parts.join('/'));
  };

  const handleNodeClick = (node: GitHubNode) => {
    if (node.type === 'dir') {
      loadPath(node.path);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 truncate pr-2" title={`${owner}/${repo}`}>
          {owner}/{repo}
        </h2>
      </div>

      <div className="p-2 bg-gray-850 border-b border-gray-800 flex items-center text-xs text-gray-400 overflow-x-auto whitespace-nowrap">
        <button 
          onClick={() => loadPath('')}
          className="hover:text-blue-400 transition-colors mr-1"
        >
          root
        </button>
        {currentPath && (
          <>
            <span className="mx-1">/</span>
            {currentPath.split('/').map((part, index, arr) => {
              const pathSoFar = arr.slice(0, index + 1).join('/');
              return (
                <React.Fragment key={pathSoFar}>
                  <button 
                    onClick={() => loadPath(pathSoFar)}
                    className="hover:text-blue-400 transition-colors mx-1"
                  >
                    {part}
                  </button>
                  {index < arr.length - 1 && <span className="text-gray-600">/</span>}
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm p-2 text-center">{error}</div>
        ) : (
          <div className="space-y-0.5">
            {currentPath && (
              <button
                onClick={handleNavigateUp}
                className="w-full flex items-center px-2 py-1.5 text-gray-400 hover:bg-gray-800 rounded text-sm text-left"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                ..
              </button>
            )}
            
            {nodes.length === 0 && (
              <div className="text-gray-500 text-sm text-center py-4">Empty directory</div>
            )}

            {nodes.map((node) => (
              <button
                key={node.sha}
                onClick={() => handleNodeClick(node)}
                className={`w-full flex items-center px-2 py-1.5 rounded text-sm text-left transition-colors group ${
                  selectedFile?.sha === node.sha 
                    ? 'bg-blue-900/30 text-blue-300' 
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {node.type === 'dir' ? (
                  <Folder className="w-4 h-4 mr-2 text-blue-400 group-hover:text-blue-300" />
                ) : (
                  <FileCode className="w-4 h-4 mr-2 text-gray-500 group-hover:text-gray-400" />
                )}
                <span className="truncate">{node.name}</span>
                {node.type === 'dir' && <ChevronRight className="w-3 h-3 ml-auto text-gray-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
