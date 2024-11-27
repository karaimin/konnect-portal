const express = require('express')
const path = require('path')
const morgan = require('morgan')
const crypto = require('crypto')
const { logger, morganStream } = require('./logger')

const app = express()

// Get API URL from environment variable with fallback
const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:8000'

// Use Morgan for HTTP request logging
app.use(morgan('combined', { stream: morganStream }))

// Add request ID middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
})

// Serve the runtime config
app.get('/config.js', (req, res) => {
  logger.info('Serving config', {
    requestId: req.requestId,
    apiBaseUrl
  })

  res.set('Content-Type', 'application/javascript')
  res.send(`window.__APP_CONFIG__ = {
    apiBaseUrl: "${apiBaseUrl}"
  }`)
})

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../dist')))

// Handle SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: {
      message: err.message,
      stack: err.stack
    }
  })

  res.status(500).json({
    error: 'Internal Server Error',
    requestId: req.requestId
  })
})

const port = process.env.PORT || 3000

app.listen(port, () => {
  logger.info('Server started', {
    port,
    apiBaseUrl,
    nodeEnv: process.env.NODE_ENV
  })
})

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    error: {
      message: err.message,
      stack: err.stack
    }
  })
  process.exit(1)
})

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', {
    error: {
      message: err.message,
      stack: err.stack
    }
  })
  process.exit(1)
}) 