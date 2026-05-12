from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_chat_attachment, name='chat-upload'),
]