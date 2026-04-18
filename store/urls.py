from django.urls import path
from . import views

urlpatterns = [
    # Страницы
    path('',            views.index,   name='index'),

    # Каталог (AJAX-фильтрация)
    path('catalog/',    views.catalog, name='catalog'),

    # Оформление заказа
    path('checkout/',   views.checkout, name='checkout'),

    # Детальная страница товара (опционально)
    path('product/<int:pk>/', views.product_detail, name='product_detail'),
]