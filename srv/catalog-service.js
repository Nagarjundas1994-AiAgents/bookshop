const cds = require('@sap/cds')

module.exports = cds.service.impl(async function () {
  const { expensive_books, bahi, Reviews, Customers, Orders, OrderItems } = this.entities

  // --- Validation: keep CREATE / UPDATE clean ---
  this.before(['CREATE', 'UPDATE'], 'bahi', (req) => {
    const { price, stock, rating } = req.data
    if (price != null && price <= 0) req.error(400, 'Price must be > 0')
    if (stock != null && stock < 0) req.error(400, 'Stock cannot be negative')
    if (rating != null && (rating < 0 || rating > 5)) req.error(400, 'Rating must be 0..5')
  })

  this.before(['CREATE', 'UPDATE'], 'Reviews', (req) => {
    const { rating } = req.data
    if (rating != null && (rating < 1 || rating > 5)) req.error(400, 'Review rating must be 1..5')
  })

  // --- Existing: most expensive book ---
  this.on('mostExpensive', async (req) => {
    const mostExpensive = await SELECT.one.from(expensive_books).orderBy({ price: 'desc' })
    return mostExpensive
  })

  // --- New: cheapest book ---
  this.on('cheapest', async () => {
    return SELECT.one.from(bahi).orderBy({ price: 'asc' })
  })

  // --- Stats functions ---
  this.on('totalStock', async () => {
    const row = await SELECT.one.from(bahi).columns('sum(stock) as total')
    return row?.total ?? 0
  })

  this.on('averagePrice', async () => {
    const row = await SELECT.one.from(bahi).columns('avg(price) as avgPrice')
    return row?.avgPrice ?? 0
  })

  this.on('countOutOfStock', async () => {
    const row = await SELECT.one.from(bahi).columns('count(*) as count').where({ stock: 0 })
    return row?.count ?? 0
  })

  this.on('inventoryValue', async () => {
    const row = await SELECT.one.from(bahi).columns('sum(price * stock) as value')
    return row?.value ?? 0
  })

  this.on('bookRating', async (req) => {
    const { bookID } = req.data
    if (!bookID) return req.error(400, 'Please give bookID')
    const row = await SELECT.one.from(Reviews).columns('avg(rating) as avgR').where({ book_ID: bookID })
    if (row?.avgR != null) return Number(row.avgR)
    const book = await SELECT.one.from(bahi).columns('rating').where({ ID: bookID })
    return book?.rating ?? 0
  })

  this.on('genreStats', async () => {
    const genres = await SELECT.from('sap.capire.bookshop.Genres').columns(['ID', 'name'])
    const out = []
    for (const g of genres) {
      const books = await SELECT.from(bahi).where({ genre_ID: g.ID })
      const bookCount = books.length
      const totalStock = books.reduce((s, b) => s + (b.stock ?? 0), 0)
      const avgPrice = bookCount ? books.reduce((s, b) => s + Number(b.price ?? 0), 0) / bookCount : 0
      out.push({ genreID: g.ID, genreName: g.name, bookCount, totalStock, avgPrice: Number(avgPrice.toFixed(2)) })
    }
    return out
  })

  this.on('authorStats', async (req) => {
    const { authorID } = req.data
    if (!authorID) return req.error(400, 'Please give authorID')
    const author = await SELECT.one.from('sap.capire.bookshop.Authors').where({ ID: String(authorID) })
    if (!author) return req.error(404, 'Author not found')
    const books = await SELECT.from(bahi).where({ author_ID: String(authorID) })
    const bookCount = books.length
    const totalStock = books.reduce((s, b) => s + (b.stock ?? 0), 0)
    const avgRating = bookCount ? books.reduce((s, b) => s + Number(b.rating ?? 0), 0) / bookCount : 0
    return { authorID: String(authorID), authorName: author.name, bookCount, totalStock, avgRating: Number(avgRating.toFixed(2)) }
  })

  // --- Search / filter functions ---
  this.on('booksByPriceRange', async (req) => {
    const { min, max } = req.data
    if (min == null || max == null) return req.error(400, 'Please give both min and max')
    if (min > max) return req.error(400, 'min must be <= max')
    return SELECT.from(bahi).where({ price: { '>=': min, '<=': max } }).orderBy({ price: 'asc' })
  })

  this.on('searchBooks', async (req) => {
    const { query } = req.data
    if (!query) return req.error(400, 'Please give a search query')
    return SELECT.from(bahi).where`title like ${'%' + query + '%'}`.orderBy({ title: 'asc' })
  })

  this.on('booksByAuthor', async (req) => {
    const { authorID } = req.data
    if (authorID == null || authorID === '') return req.error(400, 'Please give authorID')
    return SELECT.from(bahi).where({ author_ID: String(authorID) }).orderBy({ title: 'asc' })
  })

  this.on('booksByGenre', async (req) => {
    const { genreID } = req.data
    if (genreID == null) return req.error(400, 'Please give genreID')
    return SELECT.from(bahi).where({ genre_ID: genreID }).orderBy({ title: 'asc' })
  })

  this.on('topRated', async (req) => {
    const { limit = 5 } = req.data
    return SELECT.from(bahi).orderBy({ rating: 'desc' }).limit(Number(limit))
  })

  this.on('newReleases', async (req) => {
    const { limit = 5 } = req.data
    return SELECT.from(bahi).orderBy({ publishedAt: 'desc' }).limit(Number(limit))
  })

  this.on('lowStockBooks', async (req) => {
    const { threshold = 5 } = req.data
    return SELECT.from(bahi).where({ stock: { '<': Number(threshold) } }).orderBy({ stock: 'asc' })
  })

  this.on('getReviews', async (req) => {
    const { bookID } = req.data
    if (!bookID) return req.error(400, 'Please give bookID')
    return SELECT.from(Reviews).where({ book_ID: String(bookID) }).orderBy({ createdAt: 'desc' })
  })

  this.on('customersByCountry', async (req) => {
    const { country } = req.data
    if (!country) return req.error(400, 'Please give country code, e.g. IND')
    return SELECT.from(Customers).where({ country }).orderBy({ name: 'asc' })
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/addStock
  this.on('addStock', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { amount } = req.data
    if (amount == null || amount <= 0) return req.error(400, 'Please give amount > 0')

    await UPDATE(bahi).set({ stock: { '+=': amount } }).where({ ID })
    const updated = await SELECT.one.from(bahi).where({ ID })
    return updated
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/removeStock
  this.on('removeStock', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { amount } = req.data
    if (amount == null || amount <= 0) return req.error(400, 'Please give amount > 0')

    const book = await SELECT.one.from(bahi).where({ ID })
    if (!book) return req.error(404, 'Book not found')
    if ((book.stock ?? 0) < amount) return req.error(400, `Only ${book.stock} in stock, cannot remove ${amount}`)

    await UPDATE(bahi).set({ stock: { '-=': amount } }).where({ ID })
    return SELECT.one.from(bahi).where({ ID })
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/applyDiscount
  this.on('applyDiscount', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { percent } = req.data
    if (percent == null || percent <= 0 || percent >= 100) return req.error(400, 'Please give percent between 0 and 100')

    const book = await SELECT.one.from(bahi).where({ ID })
    if (!book) return req.error(404, 'Book not found')

    const newPrice = Number(book.price) * (1 - Number(percent) / 100)
    await UPDATE(bahi).set({ price: newPrice.toFixed(2) }).where({ ID })
    return SELECT.one.from(bahi).where({ ID })
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/setPrice
  this.on('setPrice', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { newPrice } = req.data
    if (newPrice == null || newPrice <= 0) return req.error(400, 'Please give newPrice > 0')

    await UPDATE(bahi).set({ price: newPrice }).where({ ID })
    return SELECT.one.from(bahi).where({ ID })
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/rateBook
  this.on('rateBook', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { rating } = req.data
    if (rating == null || rating < 0 || rating > 5) return req.error(400, 'Please give rating 0..5')
    await UPDATE(bahi).set({ rating }).where({ ID })
    return SELECT.one.from(bahi).where({ ID })
  })

  // BOUND action: POST /CatalogService/bahi(<ID>)/addReview
  this.on('addReview', 'bahi', async (req) => {
    const { ID } = req.params[0]
    const { reviewer, rating, title, comment } = req.data
    if (!reviewer) return req.error(400, 'Please give reviewer name')
    if (rating == null || rating < 1 || rating > 5) return req.error(400, 'Please give rating 1..5')
    const book = await SELECT.one.from(bahi).where({ ID })
    if (!book) return req.error(404, 'Book not found')

    const [review] = await INSERT.into(Reviews).entries({ book_ID: String(ID), reviewer, rating, title, comment })
    // Recalculate cached average rating on the book
    const row = await SELECT.one.from(Reviews).columns('avg(rating) as avgR').where({ book_ID: String(ID) })
    if (row?.avgR != null) await UPDATE(bahi).set({ rating: Number(Number(row.avgR).toFixed(2)) }).where({ ID })
    return SELECT.one.from(Reviews).where({ ID: review.ID })
  })

  // UNBOUND action: POST /CatalogService/resetAllStock
  this.on('resetAllStock', async (req) => {
    await UPDATE(bahi).set({ stock: 0 })
    return 'All books stock reset to 0'
  })

  // UNBOUND action: POST /CatalogService/restockLowStock
  this.on('restockLowStock', async (req) => {
    const { threshold = 10, amount = 20 } = req.data
    if (amount <= 0) return req.error(400, 'amount must be > 0')

    const affected = await UPDATE(bahi).set({ stock: { '+=': amount } }).where({ stock: { '<': threshold } })
    return `${affected} book(s) below stock ${threshold} restocked by ${amount}`
  })

  // UNBOUND action: POST /CatalogService/discountByGenre
  this.on('discountByGenre', async (req) => {
    const { genreID, percent } = req.data
    if (genreID == null) return req.error(400, 'Please give genreID')
    if (percent == null || percent <= 0 || percent >= 100) return req.error(400, 'Please give percent between 0 and 100')

    const books = await SELECT.from(bahi).where({ genre_ID: genreID })
    if (!books.length) return `No books found for genre ${genreID}`

    for (const b of books) {
      const newPrice = Number(b.price) * (1 - Number(percent) / 100)
      await UPDATE(bahi).set({ price: newPrice.toFixed(2) }).where({ ID: b.ID })
    }
    return `${books.length} book(s) in genre ${genreID} discounted by ${percent}%`
  })

  // UNBOUND action: POST /CatalogService/discountByAuthor
  this.on('discountByAuthor', async (req) => {
    const { authorID, percent } = req.data
    if (!authorID) return req.error(400, 'Please give authorID')
    if (percent == null || percent <= 0 || percent >= 100) return req.error(400, 'Please give percent between 0 and 100')

    const books = await SELECT.from(bahi).where({ author_ID: String(authorID) })
    if (!books.length) return `No books found for author ${authorID}`
    for (const b of books) {
      const newPrice = Number(b.price) * (1 - Number(percent) / 100)
      await UPDATE(bahi).set({ price: newPrice.toFixed(2) }).where({ ID: b.ID })
    }
    return `${books.length} book(s) by author ${authorID} discounted by ${percent}%`
  })

  // UNBOUND action: POST /CatalogService/recalculateRatings
  this.on('recalculateRatings', async () => {
    const books = await SELECT.from(bahi).columns(['ID'])
    let n = 0
    for (const b of books) {
      const row = await SELECT.one.from(Reviews).columns('avg(rating) as avgR').where({ book_ID: String(b.ID) })
      if (row?.avgR != null) {
        await UPDATE(bahi).set({ rating: Number(Number(row.avgR).toFixed(2)) }).where({ ID: b.ID })
        n++
      }
    }
    return `${n} book rating(s) recalculated from reviews`
  })

  // UNBOUND action: POST /CatalogService/placeOrder
  this.on('placeOrder', async (req) => {
    const { customerID, bookID, quantity } = req.data
    if (!customerID || !bookID) return req.error(400, 'Please give customerID and bookID')
    const qty = Number(quantity ?? 1)
    if (qty <= 0) return req.error(400, 'quantity must be > 0')

    const customer = await SELECT.one.from(Customers).where({ ID: String(customerID) })
    if (!customer) return req.error(404, 'Customer not found')
    const book = await SELECT.one.from(bahi).where({ ID: String(bookID) })
    if (!book) return req.error(404, 'Book not found')
    if ((book.stock ?? 0) < qty) return req.error(400, `Only ${book.stock} in stock, cannot order ${qty}`)

    const total = Number(book.price) * qty
    const [order] = await INSERT.into(Orders).entries({
      customer_ID: String(customerID), orderDate: new Date().toISOString(), status: 'Open', total: total.toFixed(2)
    })
    await INSERT.into(OrderItems).entries({ order_ID: order.ID, book_ID: String(bookID), quantity: qty, unitPrice: book.price })
    await UPDATE(bahi).set({ stock: { '-=': qty } }).where({ ID: String(bookID) })
    return SELECT.one.from(Orders).where({ ID: order.ID })
  })

  // UNBOUND action: POST /CatalogService/deleteOutOfStock
  this.on('deleteOutOfStock', async () => {
    const deleted = await DELETE.from(bahi).where({ stock: 0 })
    return `${deleted} out-of-stock book(s) deleted`
  })
})
