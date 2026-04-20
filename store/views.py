import json
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .models import Product, Order, OrderItem, Category


def index(request):
    products = Product.objects.filter(is_active=True)
    categories = Category.objects.all()

    return render(request, 'index.html', {
        'products': products,
        'categories': categories,
    })


def catalog(request):
    category = request.GET.get('category', 'all')
    products = Product.objects.filter(is_active=True)

    if category != 'all':
        products = products.filter(category__slug=category)

    if request.headers.get('x-requested-with') == 'XMLHttpRequest':
        data = [
            {
                'id': p.pk,
                'name_ru': p.name_ru,
                'name_ky': p.name_ky,
                'desc_ru': p.desc_ru,
                'desc_ky': p.desc_ky,
                'price': str(p.price),
                'badge': p.badge,
                'category': p.category.name,
            }
            for p in products
        ]
        return JsonResponse({'products': data})

    return render(request, 'index.html', {
        'products': products,
        'categories': Category.objects.all(),
        'active_category': category,
    })


def product_detail(request, pk):
    product = get_object_or_404(Product, pk=pk, is_active=True)
    return render(request, 'product_detail.html', {'product': product})


@require_POST
def checkout(request):
    try:
        payload = json.loads(request.body)
    except:
        return JsonResponse({'ok': False, 'error': 'bad json'}, status=400)

    name = payload.get('name')
    phone = payload.get('phone')
    items = payload.get('items', [])

    if not name or not phone or not items:
        return JsonResponse({'ok': False, 'error': 'missing fields'}, status=400)

    order = Order.objects.create(
        customer_name=name,
        customer_phone=phone,
        customer_email=payload.get('email', ''),
        address=payload.get('address', ''),
    )

    total = 0

    for item in items:
        product = get_object_or_404(Product, pk=item['id'])
        qty = int(item.get('qty', 1))

        OrderItem.objects.create(
            order=order,
            product=product,
            price=product.price,
            quantity=qty
        )

        total += product.price * qty

    order.total = total
    order.save()

    return JsonResponse({
        'ok': True,
        'order_id': order.pk,
        'total': str(total)
    })