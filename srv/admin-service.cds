using { sap.capire.bookshop as my } from '../db/schema';

// Back-office service: full CRUD + housekeeping actions.
// Keep CatalogService as the public storefront; AdminService is for staff.
@path: '/odata/v4/admin'
service AdminService {

    entity Books     as projection on my.Books;
    entity Authors   as projection on my.Authors;
    entity Genres    as projection on my.Genres;
    entity Reviews   as projection on my.Reviews;
    entity Customers as projection on my.Customers;
    entity Orders    as projection on my.Orders;
    entity OrderItems as projection on my.OrderItems;

    type OrderStat {
        status : String;
        count  : Integer;
        total  : Decimal;
    };

    // Housekeeping actions (unbound)
    action bulkUpdatePrices(percent : Decimal) returns String;
    action recalculateOrderTotals() returns String;
    action archiveZeroStockBooks() returns String;
    action adjustLoyalty(customerID : String, points : Integer) returns Customers;
    action setOrderStatus(orderID : String, status : String) returns Orders;
    action deleteReview(reviewID : String) returns String;

    // Admin insights (functions)
    function orderStats() returns array of OrderStat;
    function topCustomers(limit : Integer) returns array of Customers;
    function reviewsForModeration(minRating : Integer) returns array of Reviews;
}
