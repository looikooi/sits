from django.contrib import admin
from .models import Product, Order, OrderItem
from .models import Category

admin.site.register(Category)

# ===== PRODUCT ADMIN =====
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'name_ru',
        'category',
        'price',
        'badge',
        'is_active',
        'created_at'
    )
    list_filter = ('category', 'badge', 'is_active')
    search_fields = ('name_ru', 'name_ky')
    list_editable = ('price', 'is_active', 'badge')
    ordering = ('category', 'id')


# ===== ORDER ITEM INLINE =====
class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    readonly_fields = ('price',)


# ===== ORDER ADMIN =====
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'customer_name',
        'customer_phone',
        'status',
        'total',
        'created_at'
    )
    list_filter = ('status', 'created_at')
    search_fields = ('customer_name', 'customer_phone', 'customer_email')
    list_editable = ('status',)
    inlines = [OrderItemInline]
    readonly_fields = ('total', 'created_at')


# ===== ORDER ITEM ADMIN (отдельно, если надо) =====
@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'product', 'quantity', 'price')