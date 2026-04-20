import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from .models import Product, Order, OrderItem, Category


def index(request):
    """Главная страница — отдаёт все активные товары."""
    products = Product.objects.filter(is_active=True)
    categories = Category.objects.all()
    return render(request, 'index.html', {
        'products':   products,
        'categories': categories,
    })


def catalog(request):
    """
    Каталог с фильтрацией по категории.
    GET ?category=writing  → возвращает HTML-фрагмент (для AJAX)
    или полную страницу.
    """
    category = request.GET.get('category', 'all')
    products = Product.objects.filter(is_active=True)

    if category and category != 'all':
        products = products.filter(category=category)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        # Возвращаем только JSON со списком товаров для JS-фронтенда
        data = [
            {
                'id':      p.pk,
                'name_ru': p.name_ru,
                'name_ky': p.name_ky,
                'desc_ru': p.desc_ru,
                'desc_ky': p.desc_ky,
                'price':   str(p.price),
                'emoji':   p.emoji,
                'badge':   p.badge,
                'category': p.category,
            }
            for p in products
        ]
        return JsonResponse({'products': data})

    return render(request, 'index.html', {
        'products':        products,
        'categories':      Category.choices,
        'active_category': category,
    })


def product_detail(request, pk):
    product = get_object_or_404(Product, pk=pk, is_active=True)
    return render(request, 'product_detail.html', {'product': product})


@require_POST
def checkout(request):
    """
    Принимает JSON-корзину с фронтенда и создаёт Order + OrderItems.

    Ожидаемый формат тела запроса:
    {
        "name":  "Иван",
        "phone": "+996 700 000 000",
        "email": "ivan@example.com",
        "address": "ул. Чуй 1",
        "items": [
            {"id": 1, "qty": 2},
            {"id": 5, "qty": 1}
        ]
    }
    """
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Неверный формат данных'}, status=400)

    name    = payload.get('name', '').strip()
    phone   = payload.get('phone', '').strip()
    email   = payload.get('email', '').strip()
    address = payload.get('address', '').strip()
    items   = payload.get('items', [])

    if not name or not phone or not items:
        return JsonResponse({'ok': False, 'error': 'Заполните обязательные поля'}, status=400)

    order = Order.objects.create(
        customer_name=name,
        customer_phone=phone,
        customer_email=email,
        address=address,
    )

    total = 0
    for item in items:
        product = get_object_or_404(Product, pk=item['id'], is_active=True)
        qty     = max(1, int(item.get('qty', 1)))
        OrderItem.objects.create(order=order, product=product, price=product.price, quantity=qty)
        total += product.price * qty

    order.total = total
    order.save()

    return JsonResponse({'ok': True, 'order_id': order.pk, 'total': str(total)})

