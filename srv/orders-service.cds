using { sap.capire.bookshop as my } from '../db/schema';

// Customer ordering flow: browse books, build an order, submit / cancel it.
@path: '/odata/v4/orders'
service OrdersService {

    entity Orders as projection on my.Orders actions {
        action submit() returns Orders;
        action cancel() returns Orders;
        action ship() returns Orders;
        action addItem(bookID : String, quantity : Integer) returns OrderItems;
        action removeItem(itemID : String) returns String;
    };

    entity OrderItems as projection on my.OrderItems;
    entity Customers  as projection on my.Customers;

    @readonly entity BookList as projection on my.Books {
        ID, title, price, stock, rating, author, genre
    };

    // Unbound ordering actions
    action createOrder(customerID : String) returns Orders;
    action checkout(orderID : String) returns Orders;

    // Order insights (functions)
    function orderTotal(orderID : String) returns Decimal;
    function ordersByCustomer(customerID : String) returns array of Orders;
    function openOrders() returns array of Orders;
}
