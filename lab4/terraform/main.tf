resource "libvirt_volume" "ubuntu-base" {
  name   = "ubuntu-base.qcow2"
  pool   = "default"
  source = "${path.module}/noble-server-cloudimg-amd64.img"
  format = "qcow2"
}

resource "libvirt_volume" "worker-disk" {
  name           = "worker-disk.qcow2"
  base_volume_id = libvirt_volume.ubuntu-base.id
  pool           = "default"
  size           = 10737418240 # 10 GB
}

resource "libvirt_volume" "db-disk" {
  name           = "db-disk.qcow2"
  base_volume_id = libvirt_volume.ubuntu-base.id
  pool           = "default"
  size           = 10737418240 # 10 GB
}

resource "libvirt_cloudinit_disk" "commoninit" {
  name      = "commoninit.iso"
  user_data = templatefile("${path.module}/cloud_init.cfg", {
    ssh_key = file("/home/daniil/.ssh/ansible_key.pub")
  })
  pool      = "default"
}

resource "libvirt_domain" "worker" {
  name   = "worker"
  type   = "qemu"
  memory = "1024"
  vcpu   = 1

  cloudinit = libvirt_cloudinit_disk.commoninit.id

  network_interface {
    network_name   = "default"
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.worker-disk.id
  }

  console {
    type        = "pty"
    target_port = "0"
    target_type = "serial"
  }
}

resource "libvirt_domain" "db" {
  name   = "db"
  type   = "qemu"
  memory = "1024"
  vcpu   = 1

  cloudinit = libvirt_cloudinit_disk.commoninit.id

  network_interface {
    network_name   = "default"
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.db-disk.id
  }

  console {
    type        = "pty"
    target_port = "0"
    target_type = "serial"
  }
}

output "worker_ip" {
  value = libvirt_domain.worker.network_interface[0].addresses[0]
}

output "db_ip" {
  value = libvirt_domain.db.network_interface[0].addresses[0]
}
