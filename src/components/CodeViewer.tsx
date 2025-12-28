import React, { useEffect, useState } from 'react';
import { GitHubNode } from '../types';
import { fetchFileContent } from '../services/githubService';
import { Loader2, Code2, AlertCircle, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CodeViewerProps {
  file: GitHubNode | null;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setContent('');
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        if (file.download_url) {
            const text = await fetchFileContent(file.download_url);
            setContent(text);
        } else {
            setError("Cannot display this file type (no download URL).");
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load file content');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [file]);

  if (!file) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900 border-l border-r border-gray-800">
        <Code2 className="w-16 h-16 mb-4 opacity-20" />
        <p>Select a file to view its content</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 border-x border-gray-800 min-w-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-850">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-200 truncate" title={file.path}>
            {file.name}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {(file.size / 1024).toFixed(1)} KB
        </div>
      </div>

      <div className="flex-1 overflow-auto relative custom-scrollbar">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400 p-4 text-center">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="p-4">
            {file.name.toLowerCase().endsWith('.md') ? (
              <div className="prose prose-invert max-w-none prose-sm">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            ) : (
              <pre className="font-mono text-sm text-gray-300 leading-relaxed tab-4">
                <code>{content}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};