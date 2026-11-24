import { createProxyMiddleware } from 'http-proxy-middleware'

export function setupProxy(app) {
  const routes = [
    ['/api/auth', process.env.AUTH_SERVICE_URL || 'http://localhost:5001', 'Auth service'],
    ['/api/users', process.env.USER_SERVICE_URL || 'http://localhost:5002', 'User service'],
    ['/api/admin/users', process.env.USER_SERVICE_URL || 'http://localhost:5002', 'User service'],
    ['/api/admin/dashboard', process.env.USER_SERVICE_URL || 'http://localhost:5002', 'User service'],
    ['/api/admin/earnings', process.env.USER_SERVICE_URL || 'http://localhost:5002', 'User service'],
    ['/api/partner', process.env.VENDOR_SERVICE_URL || 'http://localhost:5003', 'Vendor service'],
    ['/api/admin/vendors', process.env.VENDOR_SERVICE_URL || 'http://localhost:5003', 'Vendor service'],
    ['/api/admin/vehicles', process.env.VENDOR_SERVICE_URL || 'http://localhost:5003', 'Vendor service'],
  ]

  for (const [path, target, serviceName] of routes) {
    console.log(`[proxy] registering ${path} -> ${target}`)
    app.use(createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: path,
      on: {
        error: (error, _req, res) => {
          console.error(`[proxy:${serviceName}] upstream error:`, error.message)
          if (!res.headersSent) {
            res.status(502).json({ message: `${serviceName} unavailable. Please try again.` })
          }
        },
      },
    }))
  }
}
