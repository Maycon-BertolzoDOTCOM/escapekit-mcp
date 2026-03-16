
import React, { useState, useEffect, Suspense } from 'react';
import * as Sentry from "@sentry/react";
import ImageUploader from './components/ImageUploader';
import MaterialSelector from './components/MaterialSelector';
import ResultViewer from './components/ResultViewer';
import AnalysisPanel from './components/AnalysisPanel';
import { ImageAnalysis, Material, Point, ProcessingState, SimulationHistory as HistoryItem, ValidationResult } from './types';
import { fileToBase64, urlToBase64, parseSimulationParams, optimizeImage } from './utils';
import { SecurityCircuitBreaker } from './services/geminiCommon';
import { materialService } from './services/materialService';
import { Dashboard } from './pages/Dashboard';

// Lazy load heavy components
const ScaleCalibrationModal = React.lazy(() => import('./components/ScaleCalibrationModal').then(m => ({ default: m.ScaleCalibrationModal })));
const ManualMaskingModal = React.lazy(() => import('./components/ManualMaskingModal').then(m => ({ default: m.ManualMaskingModal })));

import { useTelemetryShortcuts } from './hooks/useTelemetryShortcuts';
import { useSimulationFlow } from './hooks/useSimulationFlow';
import { useTelemetry } from './hooks/useTelemetry';

// --- TOAST COMPONENT (Simples) ---
interface ToastMsg { id: number; message: string; type: 'success' | 'error' | 'warning' }
const ToastContainer: React.FC<{ toasts: ToastMsg[] }> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`
                    pointer-events-auto px-4 py-3 rounded-lg shadow-xl backdrop-blur-md border animate-fade-in flex items-center gap-3 min-w-[300px]
                    ${t.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
                    ${t.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : ''}
                    ${t.type === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : ''}
                `}>
          <i className={`fas ${t.type === 'success' ? 'fa-check-circle' :
            t.type === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle'
            }`}></i>
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
};

const App: React.FC = () => {
  // Dashboard Route Protection
  if (window.location.pathname === '/internal/orchestrator') {
    if (import.meta.env.VITE_DASHBOARD_ENABLED !== 'true') {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="bg-white p-8 rounded-xl shadow border border-red-100 text-center max-w-sm"><h2 className="text-xl font-bold text-red-600 mb-2">Acesso Negado</h2><p className="text-gray-600 text-sm">O Dashboard não está ativo neste ambiente.</p></div></div>;
    }
    return <Dashboard />;
  }

  // --- HOOKS DE ARQUITETURA ---
  useTelemetryShortcuts();
  const { trackEvent } = useTelemetry();

  // State Global
  const [materials, setMaterials] = useState<Material[]>([]);

  // State de UI
  const [isMaterialListExpanded, setIsMaterialListExpanded] = useState(true);
  const [isConsultantMode, setIsConsultantMode] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showMaskModal, setShowMaskModal] = useState(false);

  // States de Base
  const [base64Raw, setBase64Raw] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  
  // Proteção contra loops de inicialização
  const [initAttemptCount, setInitAttemptCount] = useState(0);
  const [lastInitError, setLastInitError] = useState<string | null>(null);

  // Hook de Fluxo de Simulação
  const simulation = useSimulationFlow({
    base64Raw,
    selectedMaterial,
    analysis,
    onSetIsMaterialListExpanded: setIsMaterialListExpanded,
    onSetHistoryAutoScroll: () => { }, // Stateless per pivot
    trackEvent
  });

  // --- URL PARAMETER DETECTION (Lean Pivot) ---
  useEffect(() => {
    const isSimulatePath = window.location.pathname === '/simulate';
    const hasParams = window.location.search.length > 0;

    // Standardize: Only trigger if we are on /simulate OR on root with params
    if (!isSimulatePath && !hasParams) return;

    const { img, sku, x, y } = parseSimulationParams(window.location.search);

    const initializeFromParams = async () => {
      // Proteção contra loops: máximo 2 tentativas
      if (initAttemptCount >= 2) {
        console.warn('[URL Init] Maximum initialization attempts reached, skipping further attempts');
        return;
      }

      if (img) {
        try {
          simulation.setState('analyzing');

          // Otimiza a imagem externa antes de enviar para API
          const base64 = await optimizeImage(img);
          console.log('[URL Init] Optimized Base64 size:', (base64.length / 1024).toFixed(2), 'KB');
          setBase64Raw(base64);
          simulation.setOriginalImage(`data:image/jpeg;base64,${base64}`);

          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 })
          });

          if (!res.ok) throw new Error("Falha na análise inicial.");
          const roomContext = await res.json();
          setAnalysis(roomContext);
          simulation.setState('ready');

          if (x !== null && y !== null) {
            simulation.setFloorPoint({ x, y });
          }

          setInitAttemptCount(0); // Resetar contador em caso de sucesso
          setLastInitError(null);
        } catch (e) {
          console.error("URL Initialization error", e);
          const errorMsg = (e as Error).message || 'Erro ao carregar imagem externa';
          
          // Evitar loop infinito mostrando erro apenas uma vez
          if (lastInitError !== errorMsg) {
            simulation.setErrorMsg(errorMsg);
            setLastInitError(errorMsg);
          }
          
          simulation.setState('idle');
          
          // Incrementar contador de tentativas
          setInitAttemptCount(prev => prev + 1);
        }
      }

      if (sku && materials.length > 0) {
        const mat = materials.find(m => m.sku === sku || m.id === sku);
        if (mat) setSelectedMaterial(mat);
      }
    };

    if (materials.length > 0) {
      initializeFromParams();
    }
  }, [materials, initAttemptCount, lastInitError]);

  // --- EVENT LISTENERS ---
  useEffect(() => {
    const handleToast = (e: Event) => {
      const { message, type, duration } = (e as CustomEvent).detail;
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration || 3000);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const data = await materialService.fetchMaterials();
        setMaterials(data);
      } catch (e) {
        console.error("Catalog load error", e);
        simulation.setErrorMsg("Catálogo indisponível.");
      }
    };
    loadCatalog();
  }, []);

  const handleManualUpload = async (file: File) => {
    try {
      trackEvent('upload_started');
      simulation.setState('analyzing');
      simulation.setImageSource('upload');

      // Otimiza ANTES de enviar para API (Reduz latência e consumo de RAM)
      const base64 = await optimizeImage(file);
      setBase64Raw(base64);

      // Usa a versão otimizada como preview (evita ObjectURL e economiza RAM)
      simulation.setOriginalImage(`data:image/jpeg;base64,${base64}`);

      console.log('[Upload] Sending optimized image to API...', {
        kb: (base64.length / 1024).toFixed(2),
        chars: base64.length
      });

      const startTime = Date.now();
      trackEvent('segmentation_started');
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 })
      });

      console.log('[Upload] Response status:', res.status, res.statusText);

      if (!res.ok) {
        let errorMsg = `Erro ${res.status}: ${res.statusText}`;
        const responseText = await res.text();
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch {
          if (responseText) errorMsg = responseText.substring(0, 200);
        }
        console.error('[Upload] API Error:', errorMsg);
        throw new Error(errorMsg);
      }

      const roomContext = await res.json();
      console.log('[Upload] Analysis complete:', roomContext.roomType);
      setAnalysis(roomContext);
      simulation.setState('ready');
      trackEvent('segmentation_completed', { durationMs: Date.now() - startTime });
      trackEvent('upload_success');
    } catch (e: any) {
      console.error("Upload failed:", e);
      trackEvent('upload_failed', { errorRason: e.message || "Erro ao processar imagem." });
      simulation.setErrorMsg(e.message || "Erro ao processar imagem.");
      simulation.setState('idle');
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    simulation.handleImageClick(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };

  const handleQuickShare = async () => {
    if (!simulation.resultImage || !selectedMaterial) return;
    trackEvent('export_clicked', { type: 'qrcode' });
    setIsSharing(true);
    try {
      const message = `Veja esta simulação: ${window.location.origin}/simulate?img=${encodeURIComponent(simulation.originalImage || '')}&sku=${selectedMaterial.sku}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    } catch (err) {
      console.error("Share error", err);
    } finally {
      setIsSharing(false);
    }
  };

  const getAffinityBadge = () => {
    if (!analysis || !selectedMaterial) return null;
    return { text: 'Simulação Inteligente', color: 'bg-brand-muted/80 text-white', icon: 'fa-check-circle' };
  };

  return (
    <div className="flex h-screen bg-brand-dark text-brand-text font-sans overflow-hidden">
      <ToastContainer toasts={toasts} />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 border-b border-brand-muted/10 bg-brand-card/50 backdrop-blur shrink-0 z-30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-brand-accent/20 p-1.5 rounded text-brand-accent">
                <i className="fas fa-layer-group"></i>
              </div>
              <span className="font-bold tracking-tight text-white">PisosRealView</span>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            {import.meta.env?.DEV && (
              <button
                onClick={() => { throw new Error('VTA System Test: Manual Exception Triggered'); }}
                className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-[10px] font-bold transition-all flex items-center gap-2"
              >
                <i className="fas fa-bug"></i> TEST SENTRY
              </button>
            )}
            <div className="text-sm text-brand-muted italic uppercase text-[10px] tracking-widest">
              Engine v{import.meta.env?.VITE_VTA_VERSION || '1.2.0'}
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 ${isConsultantMode ? 'bg-black flex items-center justify-center' : ''}`}>
          <div className="w-full h-full flex flex-col gap-6 lg:flex-row max-w-7xl mx-auto">

            <div className="flex-1 min-h-[400px] flex flex-col gap-4">
              {simulation.errorMsg && (
                <div className="bg-brand-card border border-brand-muted/20 p-4 rounded-xl shadow-lg flex items-start gap-3 text-sm">
                  <div className="text-yellow-500"><i className="fas fa-info-circle text-lg"></i></div>
                  <p className="text-brand-muted">{simulation.errorMsg}</p>
                </div>
              )}

              <div className="bg-brand-card/30 rounded-2xl border border-brand-muted/10 shadow-inner relative overflow-hidden flex flex-col justify-center flex-1">
                {simulation.state === 'idle' && (
                  <div className="p-8 lg:p-12 text-center">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white mb-2">Aguardando Parâmetros</h3>
                      <p className="text-brand-muted text-sm">Insira uma imagem ou utilize um link de parceiro para começar.</p>
                    </div>
                    <ImageUploader onImageSelected={handleManualUpload} />
                  </div>
                )}

                {(simulation.state === 'analyzing' || simulation.state === 'ready' || simulation.state === 'rendering' || simulation.state === 'validating') && simulation.originalImage && !simulation.resultImage && (
                  <div className="relative w-full h-full flex items-center justify-center bg-black/50">
                    <img
                      src={simulation.originalImage}
                      alt="Scene"
                      onClick={handleImageClick}
                      className={`max-w-full max-h-[70vh] object-contain shadow-2xl transition-all ${simulation.state === 'ready' ? 'cursor-crosshair' : 'opacity-50'}`}
                    />
                    {simulation.floorPoint && simulation.state === 'ready' && (
                      <div className="absolute w-8 h-8 -ml-4 -mt-4 bg-brand-accent rounded-full border-4 border-white shadow-xl z-20 flex items-center justify-center"
                        style={{ left: `${simulation.floorPoint.x}%`, top: `${simulation.floorPoint.y}%` }}>
                        <div className="w-2 h-2 bg-brand-dark rounded-full"></div>
                      </div>
                    )}
                    {simulation.state === 'rendering' && (
                      <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-black/60 z-30">
                        <p className="text-brand-accent font-bold animate-pulse">Aplicando revestimento...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* FALLBACK DE CARREGAMENTO (Evita tela azul no pivot inicial) */}
                {(simulation.state !== 'idle' && !simulation.originalImage) && (
                  <div className="p-12 text-center animate-fade-in">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-muted/20 border-t-brand-accent mb-4 mx-auto"></div>
                    <p className="text-brand-accent font-bold uppercase tracking-widest text-xs">Preparando Experiência...</p>
                    <p className="text-brand-muted text-[10px] mt-2 italic">Aguardando processamento de ativos externos</p>
                  </div>
                )}

                {simulation.state === 'complete' && simulation.originalImage && simulation.resultImage && (
                  <ResultViewer
                    originalImage={simulation.originalImage}
                    generatedImage={simulation.resultImage}
                    affinityBadge={getAffinityBadge()}
                    consultantMode={isConsultantMode}
                    validationResult={simulation.validationResult}
                    qualityScore={analysis?.qualityScore}
                    warnings={analysis ? [...(analysis.warnings || []), ...(analysis.rejections || [])] : []}
                    onShare={handleQuickShare}
                    autoCompare={isConsultantMode}
                  />
                )}
              </div>
            </div>

            <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
              {simulation.state !== 'idle' && analysis && (
                <AnalysisPanel
                  analysis={analysis}
                  onOpenScale={() => {
                    if (import.meta.env?.VITE_ENTERPRISE_MODE === 'true') setShowScaleModal(true);
                  }}
                  onOpenMask={() => {
                    if (import.meta.env?.VITE_ENTERPRISE_MODE === 'true') setShowMaskModal(true);
                  }}
                />
              )}

              {(simulation.state === 'ready' || simulation.state === 'complete') && (
                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                  <div className="flex-1 bg-brand-card/50 rounded-xl border border-brand-muted/10 overflow-hidden">
                    <MaterialSelector
                      materials={materials}
                      selectedMaterial={selectedMaterial}
                      onSelect={(mat) => {
                        setSelectedMaterial(mat);
                        trackEvent('material_selected', { materialId: mat.sku || mat.id });
                      }}
                      isExpanded={true}
                      onToggleExpand={() => { }}
                    />
                  </div>
                  <button
                    onClick={simulation.handleGenerate}
                    disabled={!selectedMaterial || !simulation.floorPoint}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-2 ${selectedMaterial && simulation.floorPoint ? 'bg-brand-accent text-white hover:bg-blue-600' : 'bg-brand-card text-brand-muted cursor-not-allowed'}`}
                  >
                    <i className="fas fa-magic"></i> Executar Simulação
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        {showScaleModal && simulation.originalImage && (
          <ScaleCalibrationModal
            imageSrc={simulation.originalImage}
            onClose={() => setShowScaleModal(false)}
            onConfirm={(cmPerPixel) => {
              setAnalysis(prev => prev ? { ...prev, scaleAnchor: cmPerPixel as any } : null);
              setShowScaleModal(false);
            }}
          />
        )}

        {showMaskModal && simulation.originalImage && (
          <ManualMaskingModal
            imageSrc={simulation.originalImage}
            onClose={() => setShowMaskModal(false)}
            onConfirm={(points) => {
              setAnalysis(prev => prev ? { ...prev, manualMaskPoints: points } : null);
              setShowMaskModal(false);
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Sentry.withErrorBoundary(App, {
  fallback: ({ error }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-brand-dark text-white p-4 text-center">
      <h2 className="text-2xl font-bold mb-2">Ops! Falha Crítica.</h2>
      <p className="text-brand-muted mb-6">Ocorreu um erro inesperado. Código de referência: {Sentry.lastEventId() || 'N/A'}</p>
      <button onClick={() => window.location.reload()} className="px-6 py-3 bg-brand-accent rounded-xl font-bold">Recarregar</button>
    </div>
  ),
});
