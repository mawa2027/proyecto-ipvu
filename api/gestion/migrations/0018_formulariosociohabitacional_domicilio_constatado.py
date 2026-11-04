from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gestion', '0017_usuario_matricula_opcional'),
    ]

    operations = [
        migrations.AddField(
            model_name='formulariosociohabitacional',
            name='domicilio_constatado',
            field=models.CharField(blank=True, default='', max_length=200),
            preserve_default=False,
        ),
    ]
