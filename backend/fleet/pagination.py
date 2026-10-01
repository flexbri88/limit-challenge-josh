from rest_framework.pagination import PageNumberPagination


class StandardResultsPagination(PageNumberPagination):
    """Page-number pagination that lets clients pick a page size up to a cap."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100
