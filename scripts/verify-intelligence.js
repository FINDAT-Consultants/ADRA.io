import { initializeIntelligence, getIntelligenceStatus, predictProjectCoding, getLiveIntelligenceInsights } from '../src/intelligence-engine.js';

const status = await initializeIntelligence();
if (!status.enabled) throw new Error('Adaptive intelligence is not enabled.');
if (!Array.isArray(status.metrics?.deepArchitecture) || status.metrics.deepArchitecture.length !== 4) throw new Error('Deep neural network architecture was not trained.');
if (Number(status.featureStore?.archiveCodingRows || 0) < 1) throw new Error('Training/reference coding rows were not loaded.');
const suggestion = predictProjectCoding('financial project follow-up', { limit: 3 });
if (!Array.isArray(suggestion)) throw new Error('Project coding predictor did not return an array.');
const insights = getLiveIntelligenceInsights();
if (!Array.isArray(insights.monthlyRisk) || !Array.isArray(insights.anomalies)) throw new Error('Live intelligence insights are invalid.');
console.log(JSON.stringify({ ok:true, quality:status.quality, featureStore:status.featureStore, deepArchitecture:status.metrics.deepArchitecture, openaiConfigured:status.openai.configured }, null, 2));
