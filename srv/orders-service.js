const cds = require('@sap/cds')

module.exports = cds.service.impl(async function () {
  const { Orders, OrderItems, Customers, BookList } = this.entities

  async function calcTotal(orderID) {
    const items = await SELECT.from(OrderItems).where({ order_ID: String(orderID) })
    return items.reduce((s, i) => s + Number(i.unitPrice ?? 0) * (i.quantity ?? 0), 0)
  }

  this.on('createOrder', async (req) => {
    const { customerID } = req.data
    if (!customerID) return req.error(400, 'Please give customerID')
    const customer = await SELECT.one.from(Customers).where({ ID: String(customerID) })
    if (!customer) return req.error(404, 'Customer not found')
    const [order] = await INSERT.into(Orders).entries({
      customer_ID: String(customerID), orderDate: new Date().toISOString(), status: 'Open', total: 0
    })
    return SELECT.one.from(Orders).where({ ID: order.ID })
  })

  this.on('checkout', async (req) => {
    const { orderID } = req.data
    if (!orderID) return req.error(400, 'Please give orderID')
    const order = await SELECT.one.from(Orders).where({ ID: String(orderID) })
    if (!order) return req.error(404, 'Order not found')
    if (order.status !== 'Open') return req.error(400, `Only Open orders can be checked out (now ${order.status})`)
    const total = await calcTotal(orderID)
    if (total <= 0) return req.error(400, 'Cannot checkout an empty order, add items first')
    await UPDATE(Orders).set({ status: 'Submitted', total: total.toFixed(2) }).where({ ID: String(orderID) })
    return SELECT.one.from(Orders).where({ ID: String(orderID) })
  })

  // Bound: POST /OrdersService/Orders(<ID>)/submit etc.
  this.on('submit', 'Orders', async (req) => {
    const { ID } = req.params[0]
    const order = await SELECT.one.from(Orders).where({ ID })
    if (!order) return req.error(404, 'Order not found')
    if (order.status !== 'Open') return req.error(400, `Only Open orders can be submitted (now ${order.status})`)
    const total = await calcTotal(ID)
    await UPDATE(Orders).set({ status: 'Submitted', total: total.toFixed(2) }).where({ ID })
    return SELECT.one.from(Orders).where({ ID })
  })

  this.on('cancel', 'Orders', async (req) => {
    const { ID } = req.params[0]
    const order = await SELECT.one.from(Orders).where({ ID })
    if (!order) return req.error(404, 'Order not found')
    if (order.status === 'Shipped') return req.error(400, 'Shipped orders cannot be cancelled')
    // Restore stock for reserved items
    const items = await SELECT.from(OrderItems).where({ order_ID: String(ID) })
    for (const i of items) {
      await UPDATE(BookList).set({ stock: { '+=': i.quantity ?? 0 } }).where({ ID: i.book_ID })
    }
    await UPDATE(Orders).set({ status: 'Cancelled' }).where({ ID })
    return SELECT.one.from(Orders).where({ ID })
  })

  this.on('ship', 'Orders', async (req) => {
    const { ID } = req.params[0]
    const order = await SELECT.one.from(Orders).where({ ID })
    if (!order) return req.error(404, 'Order not found')
    if (order.status !== 'Submitted') return req.error(400, `Only Submitted orders can be shipped (now ${order.status})`)
    await UPDATE(Orders).set({ status: 'Shipped' }).where({ ID })
    return SELECT.one.from(Orders).where({ ID })
  })

  this.on('addItem', 'Orders', async (req) => {
    const { ID } = req.params[0]
    const { bookID, quantity } = req.data
    const qty = Number(quantity ?? 1)
    if (!bookID) return req.error(400, 'Please give bookID')
    if (qty <= 0) return req.error(400, 'quantity must be > 0')
    const order = await SELECT.one.from(Orders).where({ ID })
    if (!order) return req.error(404, 'Order not found')
    if (order.status !== 'Open') return req.error(400, `Can only add items to Open orders (now ${order.status})`)
    const book = await SELECT.one.from(BookList).where({ ID: String(bookID) })
    if (!book) return req.error(404, 'Book not found')
    if ((book.stock ?? 0) < qty) return req.error(400, `Only ${book.stock} in stock, cannot add ${qty}`)

    const [item] = await INSERT.into(OrderItems).entries({
      order_ID: String(ID), book_ID: String(bookID), quantity: qty, unitPrice: book.price
    })
    await UPDATE(BookList).set({ stock: { '-=': qty } }).where({ ID: String(bookID) })
    const total = await calcTotal(ID)
    await UPDATE(Orders).set({ total: total.toFixed(2) }).where({ ID })
    return SELECT.one.from(OrderItems).where({ ID: item.ID })
  })

  this.on('removeItem', 'Orders', async (req) => {
    const { ID } = req.params[0]
    const { itemID } = req.data
    if (!itemID) return req.error(400, 'Please give itemID')
    const order = await SELECT.one.from(Orders).where({ ID })
    if (!order) return req.error(404, 'Order not found')
    if (order.status !== 'Open') return req.error(400, `Can only remove items from Open orders (now ${order.status})`)
    const item = await SELECT.one.from(OrderItems).where({ ID: String(itemID), order_ID: String(ID) })
    if (!item) return req.error(404, 'Item not found in this order')
    await UPDATE(BookList).set({ stock: { '+=': item.quantity ?? 0 } }).where({ ID: item.book_ID })
    await DELETE.from(OrderItems).where({ ID: String(itemID) })
    const total = await calcTotal(ID)
    await UPDATE(Orders).set({ total: total.toFixed(2) }).where({ ID })
    return `Item ${itemID} removed, new total ${total.toFixed(2)}`
  })

  this.on('orderTotal', async (req) => {
    const { orderID } = req.data
    if (!orderID) return req.error(400, 'Please give orderID')
    return Number((await calcTotal(orderID)).toFixed(2))
  })

  this.on('ordersByCustomer', async (req) => {
    const { customerID } = req.data
    if (!customerID) return req.error(400, 'Please give customerID')
    return SELECT.from(Orders).where({ customer_ID: String(customerID) }).orderBy({ orderDate: 'desc' })
  })

  this.on('openOrders', async () => {
    return SELECT.from(Orders).where({ status: 'Open' }).orderBy({ orderDate: 'desc' })
  })
})
