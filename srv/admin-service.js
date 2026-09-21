const cds = require('@sap/cds')

module.exports = cds.service.impl(async function () {
  const { Books, Authors, Genres, Reviews, Customers, Orders, OrderItems } = this.entities

  const ALLOWED_STATUSES = ['Open', 'Submitted', 'Shipped', 'Cancelled']

  this.on('bulkUpdatePrices', async (req) => {
    const { percent } = req.data
    if (percent == null || percent <= -90 || percent >= 200) return req.error(400, 'percent must be between -90 and 200')
    const books = await SELECT.from(Books)
    for (const b of books) {
      const newPrice = Number(b.price) * (1 + Number(percent) / 100)
      if (newPrice <= 0) continue
      await UPDATE(Books).set({ price: newPrice.toFixed(2) }).where({ ID: b.ID })
    }
    return `${books.length} book price(s) adjusted by ${percent}%`
  })

  this.on('recalculateOrderTotals', async () => {
    const orders = await SELECT.from(Orders).columns(['ID'])
    for (const o of orders) {
      const items = await SELECT.from(OrderItems).where({ order_ID: o.ID })
      const total = items.reduce((s, i) => s + Number(i.unitPrice ?? 0) * (i.quantity ?? 0), 0)
      await UPDATE(Orders).set({ total: total.toFixed(2) }).where({ ID: o.ID })
    }
    return `${orders.length} order total(s) recalculated`
  })

  this.on('archiveZeroStockBooks', async () => {
    // Demo housekeeping: report (don't delete) zero-stock books so admin can decide.
    const books = await SELECT.from(Books).columns(['ID', 'title']).where({ stock: 0 })
    if (!books.length) return 'No zero-stock books found'
    return `${books.length} zero-stock book(s): ${books.map((b) => b.title).join(', ')}`
  })

  this.on('adjustLoyalty', async (req) => {
    const { customerID, points } = req.data
    if (!customerID) return req.error(400, 'Please give customerID')
    if (points == null) return req.error(400, 'Please give points (can be negative)')
    await UPDATE(Customers).set({ loyaltyPoints: { '+=': Number(points) } }).where({ ID: String(customerID) })
    const updated = await SELECT.one.from(Customers).where({ ID: String(customerID) })
    if (!updated) return req.error(404, 'Customer not found')
    return updated
  })

  this.on('setOrderStatus', async (req) => {
    const { orderID, status } = req.data
    if (!orderID || !status) return req.error(400, 'Please give orderID and status')
    if (!ALLOWED_STATUSES.includes(status)) return req.error(400, `status must be one of ${ALLOWED_STATUSES.join(', ')}`)
    await UPDATE(Orders).set({ status }).where({ ID: String(orderID) })
    const updated = await SELECT.one.from(Orders).where({ ID: String(orderID) })
    if (!updated) return req.error(404, 'Order not found')
    return updated
  })

  this.on('deleteReview', async (req) => {
    const { reviewID } = req.data
    if (!reviewID) return req.error(400, 'Please give reviewID')
    const deleted = await DELETE.from(Reviews).where({ ID: String(reviewID) })
    return `${deleted} review(s) deleted`
  })

  this.on('orderStats', async () => {
    const orders = await SELECT.from(Orders).columns(['status', 'total'])
    const map = {}
    for (const o of orders) {
      const s = o.status ?? 'Open'
      map[s] ??= { status: s, count: 0, total: 0 }
      map[s].count++
      map[s].total += Number(o.total ?? 0)
    }
    return Object.values(map).map((r) => ({ ...r, total: Number(r.total.toFixed(2)) }))
  })

  this.on('topCustomers', async (req) => {
    const { limit = 5 } = req.data
    return SELECT.from(Customers).orderBy({ loyaltyPoints: 'desc' }).limit(Number(limit))
  })

  this.on('reviewsForModeration', async (req) => {
    const { minRating = 4 } = req.data
    // Returns low-rated reviews (rating < minRating) oldest first for moderation.
    return SELECT.from(Reviews).where({ rating: { '<': Number(minRating) } }).orderBy({ createdAt: 'asc' })
  })
})
