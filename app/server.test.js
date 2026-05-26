import request from 'supertest';
import { jest } from '@jest/globals';
import { app, pool } from './server.js';

describe('API Tests', () => {
    beforeAll(() => {
        process.env.NODE_ENV = 'test';

        jest.spyOn(pool, 'getConnection').mockRejectedValue(new Error('Mocked DB Error'));
    });

    afterAll(async () => {
        if (pool) {
            await pool.end();
        }
        jest.restoreAllMocks();
    });

    it('повинен повертати 200 OK для /health/alive', async () => {
        const res = await request(app).get('/health/alive');
        expect(res.statusCode).toEqual(200);
    });

    it('повинен повертати HTML сторінку для /', async () => {
        const res = await request(app).get('/').set('Accept', 'text/html');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Notes Service API');
    });

    it('повинен повертати 406 для / якщо Accept не HTML', async () => {
        const res = await request(app).get('/').set('Accept', 'application/json');
        expect(res.statusCode).toEqual(406);
    });

    it('повинен повертати 500 для /health/ready коли БД недоступна', async () => {
        const res = await request(app).get('/health/ready');
        expect(res.statusCode).toEqual(500);
    });

    it('повинен повертати 500 для /notes коли БД недоступна', async () => {
        const res = await request(app).get('/notes');
        expect(res.statusCode).toEqual(500);
    });
});