// Fiori Elements annotations for the Bookshop storefront + back-office + ordering.
// Loaded via "cds"."fiori" preview and the fiori build task (src: "app").

using CatalogService as catalog from '../srv/catalog-service';
using AdminService as admin from '../srv/admin-service';
using OrdersService as orders from '../srv/orders-service';

// ---------------------------------------------------------------------------
// CatalogService.bahi  ->  app/browse  (storefront ListReport / ObjectPage)
// ---------------------------------------------------------------------------
annotate catalog.bahi with @(
  Common.Label         : 'Books',
  UI.SelectionFields   : [title, genre_ID, author_ID],
  UI.HeaderInfo        : {
    TypeName       : 'Book',
    TypeNamePlural : 'Books',
    Title          : {Value : title},
    Description    : {Value : author.name}
  },
  UI.LineItem          : [
    {Value : title, Label : 'Title'},
    {Value : author.name, Label : 'Author'},
    {Value : genre.name, Label : 'Genre'},
    {Value : price, Label : 'Price'},
    {Value : stock, Label : 'Stock'},
    {Value : rating, Label : 'Rating'}
  ],
  UI.FieldGroup #Main : {
    Label : 'Book Details',
    Data  : [
      {Value : title},
      {Value : descr},
      {Value : price},
      {Value : currency},
      {Value : stock},
      {Value : rating},
      {Value : isbn},
      {Value : publishedAt}
    ]
  },
  UI.Facets            : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Book Details',
      Target : '@UI.FieldGroup#Main'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Reviews',
      Target : 'reviews/@UI.LineItem'
    }
  ]
);

annotate catalog.bahi with {
  title       @Common.Label : 'Title';
  descr       @Common.Label : 'Description';
  price       @Common.Label : 'Price';
  stock       @Common.Label : 'Stock';
  rating      @Common.Label : 'Rating';
  isbn        @Common.Label : 'ISBN';
  publishedAt @Common.Label : 'Published';
  genre       @Common.Label : 'Genre' @Common.ValueList : {
    CollectionPath : 'Genres',
    Parameters     : [
      {
        $Type             : 'Common.ValueListParameterInOut',
        LocalDataProperty : genre_ID,
        ValueListProperty : 'ID'
      },
      {
        $Type             : 'Common.ValueListParameterDisplayOnly',
        ValueListProperty : 'name'
      }
    ]
  };
  author      @Common.Label : 'Author' @Common.ValueList : {
    CollectionPath : 'lekhaka',
    Parameters     : [
      {
        $Type             : 'Common.ValueListParameterInOut',
        LocalDataProperty : author_ID,
        ValueListProperty : 'ID'
      },
      {
        $Type             : 'Common.ValueListParameterDisplayOnly',
        ValueListProperty : 'name'
      }
    ]
  };
};

annotate catalog.lekhaka with @(
  Common.Label       : 'Authors',
  UI.LineItem        : [
    {Value : name, Label : 'Name'},
    {Value : nationality, Label : 'Nationality'}
  ],
  UI.HeaderInfo      : {
    TypeName       : 'Author',
    TypeNamePlural : 'Authors',
    Title          : {Value : name}
  },
  UI.FieldGroup #Main : {
    Label : 'Author Details',
    Data  : [
      {Value : name},
      {Value : bio},
      {Value : nationality}
    ]
  },
  UI.Facets          : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Author Details',
      Target : '@UI.FieldGroup#Main'
    }
  ]
);

annotate catalog.Genres with @(
  Common.Label : 'Genres',
  UI.LineItem  : [
    {Value : name, Label : 'Name'},
    {Value : descr, Label : 'Description'}
  ]
);

annotate catalog.Reviews with @(
  Common.Label : 'Reviews',
  UI.LineItem  : [
    {Value : reviewer, Label : 'Reviewer'},
    {Value : rating, Label : 'Rating'},
    {Value : title, Label : 'Title'}
  ]
);

annotate catalog.Customers with @(
  Common.Label : 'Customers',
  UI.LineItem  : [
    {Value : name, Label : 'Name'},
    {Value : email, Label : 'Email'},
    {Value : loyaltyPoints, Label : 'Loyalty'}
  ]
);

annotate catalog.Orders with @(
  Common.Label : 'Orders',
  UI.LineItem  : [
    {Value : orderDate, Label : 'Date'},
    {Value : status, Label : 'Status'},
    {Value : total, Label : 'Total'}
  ]
);

// ---------------------------------------------------------------------------
// AdminService.Books  ->  app/admin  (back-office)
// ---------------------------------------------------------------------------
annotate admin.Books with @(
  Common.Label         : 'Books',
  UI.SelectionFields   : [title, genre_ID, author_ID],
  UI.HeaderInfo        : {
    TypeName       : 'Book',
    TypeNamePlural : 'Books',
    Title          : {Value : title},
    Description    : {Value : author.name}
  },
  UI.LineItem          : [
    {Value : title, Label : 'Title'},
    {Value : author.name, Label : 'Author'},
    {Value : genre.name, Label : 'Genre'},
    {Value : price, Label : 'Price'},
    {Value : stock, Label : 'Stock'},
    {Value : rating, Label : 'Rating'}
  ],
  UI.FieldGroup #Main : {
    Label : 'Book Details',
    Data  : [
      {Value : title},
      {Value : descr},
      {Value : price},
      {Value : currency},
      {Value : stock},
      {Value : rating},
      {Value : isbn},
      {Value : publishedAt}
    ]
  },
  UI.Facets            : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Book Details',
      Target : '@UI.FieldGroup#Main'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Reviews',
      Target : 'reviews/@UI.LineItem'
    }
  ]
);

annotate admin.Books with {
  title @Common.Label : 'Title';
  price @Common.Label : 'Price';
  stock @Common.Label : 'Stock';
  genre @Common.Label : 'Genre';
  author @Common.Label : 'Author';
};

annotate admin.Authors with @(
  Common.Label : 'Authors',
  UI.LineItem  : [
    {Value : name, Label : 'Name'},
    {Value : nationality, Label : 'Nationality'}
  ]
);

annotate admin.Orders with @(
  Common.Label : 'Orders',
  UI.LineItem  : [
    {Value : orderDate, Label : 'Date'},
    {Value : status, Label : 'Status'},
    {Value : total, Label : 'Total'}
  ],
  UI.FieldGroup #Main : {
    Label : 'Order Details',
    Data  : [
      {Value : orderDate},
      {Value : status},
      {Value : total}
    ]
  },
  UI.Facets          : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Order Details',
      Target : '@UI.FieldGroup#Main'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Items',
      Target : 'items/@UI.LineItem'
    }
  ]
);

annotate admin.OrderItems with @(
  UI.LineItem : [
    {Value : book.title, Label : 'Book'},
    {Value : quantity, Label : 'Qty'},
    {Value : unitPrice, Label : 'Unit Price'}
  ]
);

// ---------------------------------------------------------------------------
// OrdersService.Orders  ->  app/orders  (ordering flow)
// ---------------------------------------------------------------------------
annotate orders.Orders with @(
  Common.Label         : 'Orders',
  UI.SelectionFields   : [status],
  UI.HeaderInfo        : {
    TypeName       : 'Order',
    TypeNamePlural : 'Orders',
    Title          : {Value : ID},
    Description    : {Value : status}
  },
  UI.LineItem          : [
    {Value : orderDate, Label : 'Date'},
    {Value : customer.name, Label : 'Customer'},
    {Value : status, Label : 'Status'},
    {Value : total, Label : 'Total'}
  ],
  UI.FieldGroup #Main : {
    Label : 'Order Details',
    Data  : [
      {Value : orderDate},
      {Value : status},
      {Value : total}
    ]
  },
  UI.Facets            : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Order Details',
      Target : '@UI.FieldGroup#Main'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Items',
      Target : 'items/@UI.LineItem'
    }
  ]
);

annotate orders.Orders with {
  status @Common.Label : 'Status';
  total  @Common.Label : 'Total';
};

annotate orders.OrderItems with @(
  UI.LineItem : [
    {Value : book.title, Label : 'Book'},
    {Value : quantity, Label : 'Qty'},
    {Value : unitPrice, Label : 'Unit Price'}
  ]
);

annotate orders.Customers with @(
  Common.Label : 'Customers',
  UI.LineItem  : [
    {Value : name, Label : 'Name'},
    {Value : email, Label : 'Email'}
  ]
);

annotate orders.BookList with @(
  Common.Label : 'Books',
  UI.LineItem  : [
    {Value : title, Label : 'Title'},
    {Value : price, Label : 'Price'},
    {Value : stock, Label : 'Stock'},
    {Value : rating, Label : 'Rating'}
  ]
);
