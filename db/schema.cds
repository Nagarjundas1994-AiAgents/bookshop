// Persistence model: the "warehouse layout"
namespace sap.capire.bookshop;   // reverse-DNS namespace avoids collisions

using { cuid, managed } from '@sap/cds/common';  // reusable aspects (M06)

aspect Addressable {          // aspect = mixin of fields, no table of its own
  street  : String(100);
  city    : String(60);
  country : String(3);
}

entity Genres {
  key ID          : Integer;
  name            : String(100);
  descr           : String(500);
  parent          : Association to Genres;   // self-reference: genre hierarchy
  books           : Association to many Books on books.genre = $self;
}

entity Authors : cuid, Addressable {
  name        : String(200);
  bio         : String(1000);
  dateOfBirth : Date;
  nationality : String(60);
  books       : Association to many Books on books.author = $self;
}

entity Books : cuid, managed, Addressable {
  title       : localized String(200);   // translatable per language
  descr       : localized String(2000);
  genre       : Association to Genres;
  author      : Association to Authors;
  price       : Decimal(10,2);           // money without currency code yet
  currency    : String(3) default 'USD';
  stock       : Integer;
  isbn        : String(20);
  publishedAt : Date;
  rating      : Decimal(3,2) default 0;  // cached average rating 0..5
  reviews     : Association to many Reviews on reviews.book = $self;
  items       : Association to many OrderItems on items.book = $self;
}

entity Reviews : cuid, managed {
  book     : Association to Books;
  reviewer : String(100);
  rating   : Integer;                    // 1..5
  title    : String(200);
  comment  : String(1000);
}

entity Customers : cuid, Addressable {
  name          : String(200);
  email         : String(200);
  phone         : String(30);
  loyaltyPoints : Integer default 0;
  orders        : Association to many Orders on orders.customer = $self;
}

entity Orders : cuid, managed {
  customer  : Association to Customers;
  orderDate : DateTime;
  status    : String(20) default 'Open'; // Open | Submitted | Shipped | Cancelled
  total     : Decimal(12,2) default 0;
  items     : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid {
  order     : Association to Orders;
  book      : Association to Books;
  quantity  : Integer;
  unitPrice : Decimal(10,2);
}