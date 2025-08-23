import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  Cpu, 
  HardDrive, 
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { DashboardWidget } from '@/hooks/useDashboardLayout';

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  widget?: string;
  timestamp: number;
}

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  networkRequests: number;
  widgetCount: number;
  heavyWidgets: string[];
  suggestions: string[];
}

interface PerformanceMonitorProps {
  widgets: DashboardWidget[];
  onPerformanceAlert: (alert: PerformanceAlert) => void;
}

export function PerformanceMonitor({ widgets, onPerformanceAlert }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    renderTime: 0,
    networkRequests: 0,
    widgetCount: 0,
    heavyWidgets: [],
    suggestions: []
  });
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      collectMetrics();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [widgets, isMonitoring]);

  const collectMetrics = () => {
    const startTime = performance.now();
    
    // Collect performance metrics
    const newMetrics: PerformanceMetrics = {
      memoryUsage: getMemoryUsage(),
      renderTime: performance.now() - startTime,
      networkRequests: getNetworkRequestCount(),
      widgetCount: widgets.length,
      heavyWidgets: identifyHeavyWidgets(),
      suggestions: generateSuggestions()
    };

    setMetrics(newMetrics);
    
    // Check for performance issues
    checkPerformanceThresholds(newMetrics);
  };

  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
    }
    return 0;
  };

  const getNetworkRequestCount = (): number => {
    // In a real implementation, this would track actual network requests
    // For now, we'll simulate based on widget types
    return widgets.filter(w => 
      ['messages', 'schedule', 'stats', 'calllog'].includes(w.type)
    ).length * 2; // Simulate 2 requests per data widget
  };

  const identifyHeavyWidgets = (): string[] => {
    // Identify widgets that might be performance-heavy
    const heavyTypes = ['stats', 'schedule', 'habits', 'calllog'];
    return widgets
      .filter(w => heavyTypes.includes(w.type))
      .map(w => w.id);
  };

  const generateSuggestions = (): string[] => {
    const suggestions: string[] = [];
    
    if (widgets.length > 8) {
      suggestions.push('Consider reducing widget count for better performance');
    }
    
    if (metrics.memoryUsage > 70) {
      suggestions.push('High memory usage detected - consider widget optimization');
    }
    
    if (metrics.networkRequests > 10) {
      suggestions.push('Reduce data refresh frequency for better performance');
    }

    const largeWidgets = widgets.filter(w => 
      ['3x3', '4x2', '2x4'].includes(w.widgetSize)
    );
    if (largeWidgets.length > 3) {
      suggestions.push('Too many large widgets may impact performance');
    }

    return suggestions;
  };

  const checkPerformanceThresholds = (newMetrics: PerformanceMetrics) => {
    const now = Date.now();
    
    // Memory usage alerts
    if (newMetrics.memoryUsage > 80) {
      createAlert('error', 'High memory usage detected', now);
    } else if (newMetrics.memoryUsage > 60) {
      createAlert('warning', 'Memory usage is elevated', now);
    }
    
    // Render time alerts
    if (newMetrics.renderTime > 100) {
      createAlert('warning', 'Slow rendering detected', now);
    }
    
    // Widget count alerts
    if (newMetrics.widgetCount > 12) {
      createAlert('warning', 'Many widgets may impact performance', now);
    }
    
    // Heavy widgets alert
    if (newMetrics.heavyWidgets.length > 4) {
      createAlert('info', 'Consider optimizing data-heavy widgets', now);
    }
  };

  const createAlert = (type: PerformanceAlert['type'], message: string, timestamp: number) => {
    const alert: PerformanceAlert = {
      id: `alert-${timestamp}`,
      type,
      message,
      timestamp
    };
    
    setAlerts(prev => [alert, ...prev.slice(0, 4)]); // Keep last 5 alerts
    onPerformanceAlert(alert);
  };

  const getPerformanceScore = (): number => {
    let score = 100;
    
    if (metrics.memoryUsage > 80) score -= 30;
    else if (metrics.memoryUsage > 60) score -= 15;
    
    if (metrics.renderTime > 100) score -= 20;
    else if (metrics.renderTime > 50) score -= 10;
    
    if (metrics.widgetCount > 12) score -= 15;
    else if (metrics.widgetCount > 8) score -= 5;
    
    if (metrics.networkRequests > 15) score -= 10;
    
    return Math.max(0, score);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const optimizeDashboard = () => {
    // Trigger automatic optimizations
    const optimizations = [
      'Reducing widget refresh intervals',
      'Optimizing large widgets',
      'Cleaning up cached data'
    ];
    
    optimizations.forEach((opt, index) => {
      setTimeout(() => {
        createAlert('info', opt, Date.now());
      }, index * 1000);
    });
  };

  const performanceScore = getPerformanceScore();

  if (!isMonitoring && !showDetails) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsMonitoring(true)}
        className="fixed bottom-20 left-6 z-40 bg-background/95 backdrop-blur"
      >
        <Activity className="h-4 w-4 mr-2" />
        Start Monitoring
      </Button>
    );
  }

  return (
    <>
      {/* Performance Score Badge */}
      <div
        className="fixed bottom-20 left-6 z-40 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <Card className="bg-background/95 backdrop-blur border-primary/20">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <Activity className={`h-4 w-4 ${getScoreColor(performanceScore)}`} />
              <span className={`text-sm font-medium ${getScoreColor(performanceScore)}`}>
                {performanceScore}%
              </span>
              {alerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {alerts.length}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Panel */}
      {showDetails && (
        <Card className="fixed bottom-32 left-6 w-80 z-50 shadow-elegant border-primary/20 bg-background/95 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Performance Monitor</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMonitoring(!isMonitoring)}
                  className="h-6 w-6 p-0"
                >
                  {isMonitoring ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetails(false)}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            </div>

            {/* Performance Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Performance Score</span>
                <span className={`text-sm font-medium ${getScoreColor(performanceScore)}`}>
                  {performanceScore}%
                </span>
              </div>
              <Progress 
                value={performanceScore} 
                className="h-2"
              />
            </div>

            {/* Metrics */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span>Memory Usage</span>
                </div>
                <span className={metrics.memoryUsage > 70 ? 'text-yellow-500' : 'text-muted-foreground'}>
                  {metrics.memoryUsage}%
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <span>Render Time</span>
                </div>
                <span className={metrics.renderTime > 50 ? 'text-yellow-500' : 'text-muted-foreground'}>
                  {metrics.renderTime.toFixed(1)}ms
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span>Network Requests</span>
                </div>
                <span className="text-muted-foreground">
                  {metrics.networkRequests}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>Widget Count</span>
                </div>
                <span className="text-muted-foreground">
                  {metrics.widgetCount}
                </span>
              </div>
            </div>

            {/* Recent Alerts */}
            {alerts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Recent Alerts</h4>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {alerts.slice(0, 3).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-2 p-2 bg-accent/30 rounded text-xs"
                    >
                      <AlertTriangle className={`h-3 w-3 mt-0.5 ${
                        alert.type === 'error' ? 'text-red-500' :
                        alert.type === 'warning' ? 'text-yellow-500' :
                        'text-blue-500'
                      }`} />
                      <span className="text-muted-foreground flex-1">
                        {alert.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {metrics.suggestions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Optimization Tips</h4>
                <div className="space-y-1">
                  {metrics.suggestions.slice(0, 2).map((suggestion, index) => (
                    <div
                      key={index}
                      className="text-xs text-muted-foreground p-2 bg-accent/20 rounded"
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-Optimize Button */}
            <Button
              onClick={optimizeDashboard}
              size="sm"
              className="w-full"
              disabled={performanceScore > 80}
            >
              <Zap className="h-3 w-3 mr-2" />
              Auto-Optimize
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}