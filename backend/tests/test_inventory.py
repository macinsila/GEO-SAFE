def test_add_item_to_warehouse(data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Inventory Depot",
        lon=29.0500,
        lat=41.0500,
        status="active",
        capacity=100,
    )
    item = data_factory["create_item"](name="su", sku="INV-WTR-001", unit="litre")

    created_inventory = data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
        quantity=35,
    )
    fetched_inventory = data_factory["get_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
    )

    assert created_inventory["warehouse_id"] == warehouse["id"]
    assert created_inventory["item_id"] == item["id"]
    assert created_inventory["quantity"] == 35
    assert fetched_inventory is not None
    assert fetched_inventory["quantity"] == 35


def test_stock_below_threshold_warning(data_factory):
    warehouse = data_factory["create_warehouse"](
        name="Threshold Depot",
        lon=29.0700,
        lat=41.0700,
        status="active",
        capacity=100,
    )
    item = data_factory["create_item"](name="battaniye", sku="INV-BAT-001", unit="adet")

    inventory = data_factory["create_warehouse_inventory"](
        warehouse_id=warehouse["id"],
        item_id=item["id"],
        quantity=15,
    )

    threshold_ratio = 0.20
    stock_ratio = inventory["quantity"] / warehouse["capacity"]
    warning = stock_ratio < threshold_ratio

    assert warning is True
