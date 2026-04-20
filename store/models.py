from django.db import models
from decimal import Decimal


# ===== CATEGORY =====
class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


# ===== PRODUCT =====
BADGE_CHOICES = [
    ('new', 'Новинка'),
    ('sale', 'Скидка'),
    ('', 'Нет'),
]


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT)

    name_ru = models.CharField(max_length=200)
    name_ky = models.CharField(max_length=200)
    desc_ru = models.TextField()
    desc_ky = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)

    # 🔥 ВОТ ЗАМЕНА
    image = models.ImageField(upload_to='products/', blank=True, null=True)

    badge = models.CharField(
        max_length=4,
        choices=BADGE_CHOICES,
        blank=True,
        default=''
    )

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'id']

    def __str__(self):
        return self.name_ru

# ===== ORDER =====
class Order(models.Model):
    STATUS_CHOICES = [
        ('new', 'Новый'),
        ('processing', 'В обработке'),
        ('delivered', 'Доставлен'),
        ('cancelled', 'Отменён'),
    ]

    customer_name = models.CharField(max_length=100)
    customer_phone = models.CharField(max_length=20)
    customer_email = models.EmailField(blank=True)
    address = models.CharField(max_length=300, blank=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new'
    )

    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def update_total(self):
        total = sum(item.get_subtotal() for item in self.items.all())
        self.total = total
        self.save(update_fields=['total'])

    def __str__(self):
        return f'Заказ #{self.pk} — {self.customer_name}'


# ===== ORDER ITEM =====
class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True
    )

    def save(self, *args, **kwargs):
        if self.price is None:
            self.price = self.product.price

        super().save(*args, **kwargs)
        self.order.update_total()

    def get_subtotal(self):
        if self.price is None:
            return Decimal('0')
        return self.price * Decimal(self.quantity)

    def __str__(self):
        return f'{self.product.name_ru} × {self.quantity}'