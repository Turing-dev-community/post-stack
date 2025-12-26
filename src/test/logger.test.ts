import { logger, createChildLogger, loggers } from '../utils/logger';

describe('Logger', () => {
  describe('logger instance', () => {
    it('should have all log level methods', () => {
      expect(typeof logger.fatal).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('should have child method', () => {
      expect(typeof logger.child).toBe('function');
    });

    it('should log without throwing errors', () => {
      expect(() => logger.info('Test message')).not.toThrow();
      expect(() => logger.error('Error message')).not.toThrow();
      expect(() => logger.warn('Warning message')).not.toThrow();
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should log with data object', () => {
      expect(() => logger.info('Test with data', { key: 'value' })).not.toThrow();
      expect(() => logger.error('Error with data', { code: 500 })).not.toThrow();
    });
  });

  describe('createChildLogger', () => {
    it('should create a child logger with bindings', () => {
      const childLogger = createChildLogger({ requestId: 'abc123' });
      
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.error).toBe('function');
      expect(() => childLogger.info('Child log message')).not.toThrow();
    });

    it('should support nested child loggers', () => {
      const childLogger = createChildLogger({ module: 'test' });
      const nestedChild = childLogger.child({ subModule: 'nested' });
      
      expect(typeof nestedChild.info).toBe('function');
      expect(() => nestedChild.info('Nested child message')).not.toThrow();
    });
  });

  describe('pre-configured loggers', () => {
    it('should have http logger', () => {
      expect(typeof loggers.http.info).toBe('function');
      expect(() => loggers.http.info('HTTP request')).not.toThrow();
    });

    it('should have db logger', () => {
      expect(typeof loggers.db.info).toBe('function');
      expect(() => loggers.db.info('Database query')).not.toThrow();
    });

    it('should have auth logger', () => {
      expect(typeof loggers.auth.info).toBe('function');
      expect(() => loggers.auth.info('Auth event')).not.toThrow();
    });

    it('should have app logger', () => {
      expect(typeof loggers.app.info).toBe('function');
      expect(() => loggers.app.info('App event')).not.toThrow();
    });
  });
});

