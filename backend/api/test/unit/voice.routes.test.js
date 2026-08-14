import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs';

vi.mock('../../src/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 'u1', role: 'customer' }; next(); },
}));

vi.mock('../../src/middleware/rateLimiter.js', () => ({
  userLimiter: (_req, _res, next) => next(),
}));

const voiceServiceMock = vi.hoisted(() => ({
  processVoiceQuery: vi.fn(),
}));

vi.mock('../../src/services/voice/VoiceAiService.js', () => ({
  default: voiceServiceMock,
}));

vi.mock('../../src/middleware/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import voiceRoutes from '../../src/routes/voice.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/voice', voiceRoutes);
  return app;
}

describe('voice.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no audio file is provided', async () => {
    const res = await request(makeApp())
      .post('/api/v1/voice/assistant')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Audio file is required');
  });

  it('calls voiceAiService.processVoiceQuery with audio file path', async () => {
    const mockStream = {
      pipe: vi.fn(function pipeToRes(res) {
        // Simulate what the real ElevenLabs stream does: write headers + body + end
        res.set({
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
        });
        res.end(Buffer.from('fake-audio-data'));
        return res;
      }),
      on: vi.fn(),
    };
    voiceServiceMock.processVoiceQuery.mockResolvedValue(mockStream);

    // Use an actual temp file that multer can write to
    const tmpFile = path.join('/tmp', `voice-test-${Date.now()}.mp3`);
    fs.writeFileSync(tmpFile, Buffer.from('fake audio'));

    const res = await request(makeApp())
      .post('/api/v1/voice/assistant')
      .attach('audio', tmpFile);

    fs.unlinkSync(tmpFile);

    expect(res.status).toBe(200);
    expect(voiceServiceMock.processVoiceQuery).toHaveBeenCalled();
  });
});

