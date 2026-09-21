using { sap.capire.bookshop as my } from '../db/schema';

service CatalogService {

    @cds.redirection.target
    entity bahi as projection on my.Books actions {
        // Stock actions
        action addStock(amount : Integer) returns bahi;
        action removeStock(amount : Integer) returns bahi;
        // Price actions
        action applyDiscount(percent : Decimal) returns bahi;
        action setPrice(newPrice : Decimal) returns bahi;
        // Rating / review actions (bound to one book)
        action rateBook(rating : Decimal) returns bahi;
        action addReview(reviewer : String, rating : Integer, title : String, comment : String) returns Reviews;
    };

    // Unbound stock / price actions (called on service root)
    action resetAllStock() returns String;
    action restockLowStock(threshold : Integer, amount : Integer) returns String;
    action discountByGenre(genreID : Integer, percent : Decimal) returns String;
    action deleteOutOfStock() returns String;
    // New unbound actions
    action discountByAuthor(authorID : String, percent : Decimal) returns String;
    action recalculateRatings() returns String;
    action placeOrder(customerID : String, bookID : String, quantity : Integer) returns Orders;

    entity lekhaka as projection on my.Authors;
    entity Genres  as projection on my.Genres;
    entity Reviews as projection on my.Reviews;
    entity Customers as projection on my.Customers;
    entity Orders as projection on my.Orders;

    entity expensive_books as select from my.Books { ID, title, price } where price > 12;

    type GenreStat {
        genreID    : Integer;
        genreName  : String;
        bookCount  : Integer;
        totalStock : Integer;
        avgPrice   : Decimal;
    };

    type AuthorStat {
        authorID   : String;
        authorName : String;
        bookCount  : Integer;
        totalStock : Integer;
        avgRating  : Decimal;
    };

    function mostExpensive() returns expensive_books;
    function cheapest() returns expensive_books;

    // Stats functions
    function totalStock() returns Integer;
    function averagePrice() returns Decimal;
    function countOutOfStock() returns Integer;
    function inventoryValue() returns Decimal;
    function bookRating(bookID : String) returns Decimal;
    function genreStats() returns array of GenreStat;
    function authorStats(authorID : String) returns AuthorStat;

    // Search / filter functions (return lists)
    function booksByPriceRange(min : Decimal, max : Decimal) returns array of bahi;
    function searchBooks(query : String) returns array of bahi;
    function booksByAuthor(authorID : String) returns array of bahi;
    function booksByGenre(genreID : Integer) returns array of bahi;
    function topRated(limit : Integer) returns array of bahi;
    function newReleases(limit : Integer) returns array of bahi;
    function lowStockBooks(threshold : Integer) returns array of bahi;
    function getReviews(bookID : String) returns array of Reviews;
    function customersByCountry(country : String) returns array of Customers;
}
