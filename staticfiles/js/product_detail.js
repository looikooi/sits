from decimal import Decimal

from django.http            import JsonResponse
from django.shortcuts       import render, get_object_or_404
from django.views           import View
from django.views.generic   import ListView, DetailView
from django.utils.decorators import method_decorator
from django.views.decorators.http import require_POST

from .models import Product, Category, CartSession


# ─────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────
CURRENCY = "сом"


# ─────────────────────────────────────────────────────────────────
# HELPERS — работа с корзиной через сессию
# ─────────────────────────────────────────────────────────────────

def _get_cart(request) -> dict:
    """
    Возвращает корзину из сессии.
    Формат: { "product_id": {"qty": int, "price": str, ...}, ... }
    """
    return request.session.get("cart", {})


def _save_cart(request, cart: dict):
    request.session["cart"] = cart
    request.session.modified = True


def _cart_total(cart: dict) -> Decimal:
    total = Decimal("0")
    for item in cart.values():
        total += Decimal(str(item["price"])) * item["qty"]
    return total


def _cart_qty(cart: dict) -> int:
    return sum(item["qty"] for item in cart.values())


# ─────────────────────────────────────────────────────────────────
# MAIN PAGE — index
# ─────────────────────────────────────────────────────────────────

class IndexView(View):
    """
    Главная страница:
    - отдаёт все активные категории и товары в контекст
    - шаблон: store/index.html (твой index.html → переименуй)
    """
    template_name = "store/index.html"

    def get(self, request):
        categories = Category.objects.all()
        products   = Product.objects.filter(is_active=True).select_related("category")

        cart     = _get_cart(request)
        context  = {
            "categories":  categories,
            "products":    products,
            "cart_qty":    _cart_qty(cart),
            "currency":    CURRENCY,
        }
        return render(request, self.template_name, context)


# ─────────────────────────────────────────────────────────────────
# CATALOG — список товаров (отдельная страница, если нужна)
# ─────────────────────────────────────────────────────────────────

class CatalogView(ListView):
    model               = Product
    template_name       = "store/catalog.html"
    context_object_name = "products"
    paginate_by         = 16

    def get_queryset(self):
        qs       = Product.objects.filter(is_active=True).select_related("category")
        category = self.request.GET.get("category", "all")
        if category and category != "all":
            qs = qs.filter(category__slug=category)
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["categories"]       = Category.objects.all()
        ctx["active_category"]  = self.request.GET.get("category", "all")
        ctx["cart_qty"]         = _cart_qty(_get_cart(self.request))
        ctx["currency"]         = CURRENCY
        return ctx


# ─────────────────────────────────────────────────────────────────
# PRODUCT DETAIL
# ─────────────────────────────────────────────────────────────────

class ProductDetailView(DetailView):
    model               = Product
    template_name       = "store/product_detail.html"
    context_object_name = "product"

    def get_queryset(self):
        return Product.objects.filter(is_active=True).select_related("category")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["currency"] = CURRENCY
        ctx["cart_qty"] = _cart_qty(_get_cart(self.request))

        # Похожие товары: та же категория, исключаем текущий, макс 4
        ctx["related_products"] = (
            Product.objects
            .filter(is_active=True, category=self.object.category)
            .exclude(pk=self.object.pk)
            .order_by("order", "id")[:4]
        )

        # Категории для футера
        ctx["categories"] = Category.objects.all()

        return ctx


# ─────────────────────────────────────────────────────────────────
# CART API — JSON endpoints (вызываются из script.js)
# ─────────────────────────────────────────────────────────────────

class CartAddView(View):
    """
    POST /cart/add/
    Body JSON: { "product_id": 1, "qty": 1 }
    Response:  { "ok": true, "cart_qty": 3, "total": "450 сом" }
    """

    def post(self, request):
        import json
        try:
            data       = json.loads(request.body)
            product_id = str(data.get("product_id"))
            qty        = int(data.get("qty", 1))
        except (ValueError, KeyError, json.JSONDecodeError):
            return JsonResponse({"ok": False, "error": "Неверные данные"}, status=400)

        product = get_object_or_404(Product, pk=product_id, is_active=True)
        cart    = _get_cart(request)

        if product_id in cart:
            cart[product_id]["qty"] += qty
        else:
            cart[product_id] = {
                "name_ru": product.name_ru,
                "name_ky": product.name_ky,
                "price":   str(product.price),
                "emoji":   product.emoji,
                "qty":     qty,
            }

        _save_cart(request, cart)
        return JsonResponse({
            "ok":       True,
            "cart_qty": _cart_qty(cart),
            "total":    f"{_cart_total(cart):,.0f} {CURRENCY}".replace(",", " "),
        })


class CartRemoveView(View):
    """
    POST /cart/remove/
    Body JSON: { "product_id": 1 }
    """

    def post(self, request):
        import json
        try:
            data       = json.loads(request.body)
            product_id = str(data.get("product_id"))
        except (ValueError, json.JSONDecodeError):
            return JsonResponse({"ok": False, "error": "Неверные данные"}, status=400)

        cart = _get_cart(request)
        cart.pop(product_id, None)
        _save_cart(request, cart)

        return JsonResponse({
            "ok":       True,
            "cart_qty": _cart_qty(cart),
            "total":    f"{_cart_total(cart):,.0f} {CURRENCY}".replace(",", " "),
        })


class CartUpdateView(View):
    """
    POST /cart/update/
    Body JSON: { "product_id": 1, "qty": 3 }
    qty=0 → удаляет товар
    """

    def post(self, request):
        import json
        try:
            data       = json.loads(request.body)
            product_id = str(data.get("product_id"))
            qty        = int(data.get("qty", 1))
        except (ValueError, json.JSONDecodeError):
            return JsonResponse({"ok": False, "error": "Неверные данные"}, status=400)

        cart = _get_cart(request)

        if qty <= 0:
            cart.pop(product_id, None)
        elif product_id in cart:
            cart[product_id]["qty"] = qty
        else:
            return JsonResponse({"ok": False, "error": "Товар не в корзине"}, status=404)

        _save_cart(request, cart)
        return JsonResponse({
            "ok":       True,
            "cart_qty": _cart_qty(cart),
            "total":    f"{_cart_total(cart):,.0f} {CURRENCY}".replace(",", " "),
        })


class CartDetailView(View):
    """
    GET /cart/
    Возвращает текущее состояние корзины в JSON.
    Используй для синхронизации при загрузке страницы.
    """

    def get(self, request):
        cart  = _get_cart(request)
        items = []
        for pid, item in cart.items():
            items.append({
                "product_id": pid,
                **item,
                "subtotal": str(Decimal(str(item["price"])) * item["qty"]),
            })
        return JsonResponse({
            "items":    items,
            "cart_qty": _cart_qty(cart),
            "total":    f"{_cart_total(cart):,.0f} {CURRENCY}".replace(",", " "),
        })


class CartClearView(View):
    """
    POST /cart/clear/
    Очищает корзину.
    """

    def post(self, request):
        _save_cart(request, {})
        return JsonResponse({"ok": True, "cart_qty": 0, "total": f"0 {CURRENCY}"})


# ─────────────────────────────────────────────────────────────────
# CHECKOUT — оформление заказа (сохраняет snapshot в БД)
# ─────────────────────────────────────────────────────────────────

class CheckoutView(View):
    """
    POST /checkout/
    Сохраняет корзину как CartSession и очищает сессию.
    Расширяй: добавь форму контактов, оплату, email-уведомление.
    """

    def post(self, request):
        cart = _get_cart(request)
        if not cart:
            return JsonResponse({"ok": False, "error": "Корзина пуста"}, status=400)

        total = _cart_total(cart)

        CartSession.objects.create(
            session_key = request.session.session_key or "anon",
            items_json  = cart,
            total       = total,
        )

        _save_cart(request, {})

        return JsonResponse({
            "ok":     True,
            "total":  f"{total:,.0f} {CURRENCY}".replace(",", " "),
            "message": "Заказ оформлен! Мы свяжемся с вами.",
        })