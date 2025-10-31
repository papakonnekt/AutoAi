import React, { useRef, useEffect, useCallback } from 'react';

interface LivePreviewTabProps {
  virtualFileSystem: { [key: string]: string };
}

const LivePreviewTab: React.FC<LivePreviewTabProps> = ({ virtualFileSystem }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendVfsToIframe = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'LOAD_VFS',
        vfs: virtualFileSystem
      }, '*');
    }
  }, [virtualFileSystem]);

  // Send the VFS when the iframe has loaded
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const handleLoad = () => {
        sendVfsToIframe();
      };
      iframe.addEventListener('load', handleLoad);
      return () => iframe.removeEventListener('load', handleLoad);
    }
  }, [sendVfsToIframe]);

  // Also send the VFS whenever it changes (e.g., after an AI edit)
  useEffect(() => {
    sendVfsToIframe();
  }, [virtualFileSystem, sendVfsToIframe]);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Live Preview</h2>
        <button
          onClick={sendVfsToIframe}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          Refresh
        </button>
      </div>
       <div className="p-4 mb-4 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-300 text-sm">
          <p><strong className="font-bold">Hosting Environment Note:</strong></p>
          <p className="mt-1">The Live Preview feature embeds the application in an iframe. Some hosting environments, like AI Studio, have security policies (e.g., `X-Frame-Options`) that may block this and show a "refused to connect" error. This is a security measure of the platform. For full functionality, you may need to run this application on your own server.</p>
      </div>
      <div className="flex-grow bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/preview.html"
          title="Live Application Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
};

export default LivePreviewTab;